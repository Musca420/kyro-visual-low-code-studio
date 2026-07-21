import { expect, test } from "@playwright/test";

test("a non-technical user can review, reject, approve, verify and undo a Codex change", async ({ page }) => {
  const jobs = new Map<string, "plan" | "apply">();
  let sequence = 0;
  await page.route("**/api/codex/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === "/api/codex/status") return route.fulfill({ json: { authenticated: true, message: "Signed in", workspace: "C:/workspace" } });
    if (url.pathname === "/api/codex/jobs" && request.method() === "GET") return route.fulfill({ json: [] });
    if (url.pathname === "/api/codex/jobs" && request.method() === "POST") {
      const mode = (request.postDataJSON() as { mode: "plan" | "apply" }).mode, id = `ux-job-${++sequence}`;
      jobs.set(id, mode);
      return route.fulfill({ status: 202, json: { jobId: id, status: "running" } });
    }
    const match = url.pathname.match(/^\/api\/codex\/jobs\/([^/]+)$/);
    if (match && request.method() === "GET") {
      const mode = jobs.get(match[1]) ?? "plan";
      const message = mode === "plan"
        ? { summary: "Make the selected button clearer", skill: "kyro-design", operations: [{ type: "set_component_property", pageId: null, argsJson: JSON.stringify({ componentId: "button", property: "label", value: "Continue" }) }, { type: "set_component_state_style", pageId: null, argsJson: JSON.stringify({ componentId: "button", state: "focus", property: "outline", value: "3px solid #22d3ee" }) }], checks: ["Button label is clear", "Keyboard focus is visible"], confirmations: [], alreadySatisfied: false, capabilityProposal: null }
        : { status: "completed", summary: "Visual change applied", transactionId: "ux-transaction", validation: [], visualResult: "Preview captured", learningCandidate: null };
      const output = JSON.stringify({ item: { type: "agent_message", text: JSON.stringify(message) } });
      return route.fulfill({ json: { id: match[1], projectId: "project", mode, status: "completed", output, errors: "", changedFiles: [], threadId: "thread-ux", ...(mode === "apply" ? { transactionId: "ux-transaction" } : {}) } });
    }
    if (url.pathname.endsWith("/restore") && request.method() === "POST") return route.fulfill({ json: { restored: ["ux-transaction"] } });
    return route.fulfill({ status: 404, json: { error: "Unexpected test route" } });
  });
  await page.route("**/api/live/transactions/ux-transaction", (route) => route.fulfill({ json: { status: "applied", result: { verification: {
    version: 1, status: "verified", projectId: "project", baseRevision: 2, finalRevision: 3,
    startedAt: "2026-07-20T00:00:00.000Z", completedAt: "2026-07-20T00:00:01.000Z", effects: ["graph", "runtime", "visual"],
    stages: ["validation", "runtime", "visual"].map((name) => ({ name, required: true, status: "passed", detail: `${name} passed`, evidence: [{ kind: name === "validation" ? "graph" : name, summary: `${name} evidence`, hash: "a".repeat(64) }] })),
  } } } }));

  await page.goto("/");
  if (await page.locator("html").getAttribute("data-theme") === "dark") await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Project name").fill("Controlled Codex UX");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "button" }).click();
  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  await projectDownload;
  const appDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  await appDownload;
  await expect(page.getByText("TypeScript app exported as a ZIP and archived")).toBeVisible();
  await page.getByTestId("component-button").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const panel = page.getByRole("region", { name: "Codex assistant" });
  const request = panel.getByLabel("Request in plain language");
  await request.fill("Make this action clearer and keyboard accessible.");
  await panel.getByRole("button", { name: "Analyze request" }).click();

  const dialog = panel.getByRole("dialog", { name: "Make the selected button clearer" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("What will change")).toBeVisible();
  await expect(dialog.getByText("2 design")).toBeVisible();
  await expect(dialog.getByText(/Nothing has changed yet/)).toBeVisible();
  await expect(dialog.getByText(/2 planned checks/)).toBeVisible();
  await expect(dialog.getByRole("heading")).toBeFocused();
  await page.screenshot({ path: "artifacts/codex-approval-light.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByText("Plan rejected. No changes were applied.")).toBeVisible();

  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await panel.getByRole("button", { name: "Analyze request" }).click();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 680, height: 820 });
  const box = await dialog.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(680);
  await dialog.getByRole("button", { name: "Approve and apply" }).click();
  const result = panel.getByRole("region", { name: "Change verification result" });
  await expect(result.getByText("Change verified")).toBeVisible();
  await expect(result.getByText("3 reproducible evidence hashes · revision 3")).toBeVisible();
  await expect(result.getByText("Passed")).toHaveCount(3);
  await panel.getByRole("button", { name: "Evidence" }).click();
  const evidence = panel.locator(".artifact-list");
  for (const kind of ["report", "screenshot", "trace", "build", "export"]) {
    await expect(evidence.getByText(new RegExp(`^${kind} · revision`)).first()).toBeVisible();
  }
  const evidenceCount = await evidence.locator("article").count();
  await expect(evidence.getByText("verified")).toHaveCount(evidenceCount);
  await expect(evidence.getByText(/^SHA-256 [a-f0-9]{64}$/).first()).toBeVisible();
  const codexTrace = evidence.locator("article").filter({ hasText: "Codex operation trace" });
  await expect(codexTrace.getByText(/Job ux-job-3/)).toBeVisible();
  await expect(codexTrace.getByText(/Transaction ux-trans/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1200 });
  const closeMessage = page.getByRole("button", { name: "Close message" });
  if (await closeMessage.isVisible()) await closeMessage.click();
  await page.mouse.move(300, 160);
  await page.screenshot({ path: "artifacts/artifact-registry.png", fullPage: true });
  await page.setViewportSize({ width: 680, height: 820 });
  await panel.getByRole("button", { name: "Conversation" }).click();
  await page.screenshot({ path: "artifacts/codex-controlled-change-mobile.png", fullPage: true });
  await result.getByRole("button", { name: "Undo this change" }).click();
  await expect(panel.getByText("The approved visual transaction was undone.")).toBeVisible();
});
