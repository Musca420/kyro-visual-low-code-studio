import { expect, test } from "@playwright/test";

const plan = (operationType: string, args: Record<string, unknown>, pageId: string) => JSON.stringify({
  summary: "Apply one typed visual operation",
  skill: "kyro-design",
  operations: [{ type: operationType, pageId, argsJson: JSON.stringify(args) }],
  checks: ["Graph revision advances once"], confirmations: [], alreadySatisfied: false, capabilityProposal: null,
});

test("Agent Jobs persist audit and support idempotent retry, restart, resume and cancel", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Agent Jobs ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page" }).first().click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "button" }).click();

  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  await expect.poll(async () => (await request.get(`/api/live/status?projectId=${projectId}`)).status()).toBe(200);
  const live = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const approvedPlan = plan("set_component_property", { componentId: live.selectedComponentIds[0], property: "label", value: "Persistent Job" }, live.pageId);
  const response = await request.post("/api/codex/jobs", { data: {
    mode: "apply", prompt: "Rename the selected button", approvedPlan,
    projectId: live.projectId, revision: live.revision,
    clientId: live.clientId,
    focus: { kind: "component", pageId: live.pageId, componentId: live.selectedComponentIds[0] },
  } });
  expect(response.status()).toBe(202);
  const created = await response.json();
  await expect.poll(async () => (await (await request.get(`/api/codex/jobs/${created.jobId}`)).json()).status).toBe("completed");
  await expect(page.getByTestId("component-button")).toContainText("Persistent Job");
  const completed = await (await request.get(`/api/codex/jobs/${created.jobId}`)).json();
  expect(completed.audit.map((event: { action: string }) => event.action)).toEqual(["created", "completed"]);
  const codexTransaction = await page.evaluate(async (transactionId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("frontend-editor");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = database.transaction("projectTransactions", "readonly").objectStore("projectTransactions").get(transactionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => database.close());
  }, completed.transactionId);
  expect(codexTransaction).toMatchObject({ actor: "codex", jobId: created.jobId, status: "applied", authorization: { kind: "approved_job", jobId: created.jobId } });

  const idempotent = await request.post(`/api/codex/jobs/${created.jobId}/retry`);
  expect(await idempotent.json()).toMatchObject({ jobId: created.jobId, status: "completed", reused: true });

  const current = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const invalid = await request.post("/api/codex/jobs", { data: {
    mode: "apply", prompt: "Invalid operation for recovery test", approvedPlan: "{}",
    projectId: current.projectId, revision: current.revision,
    clientId: current.clientId,
  } });
  const failed = await invalid.json();
  await expect.poll(async () => (await (await request.get(`/api/codex/jobs/${failed.jobId}`)).json()).status).toBe("error");
  for (const action of ["retry", "restart", "resume"]) {
    const replay = await request.post(`/api/codex/jobs/${failed.jobId}/${action}`);
    expect(replay.status()).toBe(202);
    const value = await replay.json();
    const replayed = await (await request.get(`/api/codex/jobs/${value.jobId}`)).json();
    expect(replayed).toMatchObject({ status: "error", attempts: 2, parentJobId: failed.jobId });
  }

  await page.getByTestId("component-button").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const panel = page.getByRole("region", { name: "Codex assistant" });
  await expect(panel.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Restart", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/agent-job-recovery.png", fullPage: true });

  await page.close();
  const pendingRequest = request.post("/api/codex/jobs", { data: {
    mode: "apply", prompt: "Cancel a pending visual operation", approvedPlan,
    projectId: current.projectId, revision: current.revision,
    clientId: current.clientId,
  } });
  let pendingId = "";
  await expect.poll(async () => {
    const jobs = await (await request.get("/api/codex/jobs")).json();
    pendingId = jobs.find((job: { projectId: string; status: string; id: string }) => job.projectId === current.projectId && job.status === "running")?.id ?? "";
    return pendingId;
  }).not.toBe("");
  const cancelled = await request.post(`/api/codex/jobs/${pendingId}/cancel`);
  expect(cancelled.status()).toBe(200);
  await pendingRequest;
  const cancelledJob = await (await request.get(`/api/codex/jobs/${pendingId}`)).json();
  expect(cancelledJob).toMatchObject({ status: "cancelled", stopReason: "cancelled" });
  expect(cancelledJob.audit.some((event: { action: string }) => event.action === "cancelled")).toBe(true);
});
