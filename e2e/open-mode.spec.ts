import { expect, test } from "@playwright/test";

test("Open Mode risolve un gap con un modulo verificato e non simula plugin mancanti", async ({ page, request }) => {
  const projectName = `Open Mode ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  const state = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const register = (args: Record<string, unknown>, requestedRevision?: number) => page.evaluate(async ({ projectId, requestedRevision, args }) => {
    const live = await fetch(`/api/live/status?projectId=${projectId}`).then((response) => response.json());
    const response = await fetch("/api/live/tools/register_global_capability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, pageId: live.pageId, revision: requestedRevision ?? live.revision, args }) });
    return { status: response.status, body: await response.json() };
  }, { projectId, requestedRevision, args });
  await expect(register({ scope: "global", kind: "typed_module", name: "Normalize names", generalizedIntent: "Normalize names across every Kyro project", inputs: ["name"], outputs: ["normalized name"], permissions: [], dependencies: [], validationTests: ["Trims surrounding spaces"], activation: "passing_tests", effects: ["data"], platforms: ["web"] })).resolves.toMatchObject({ status: 202 });

  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  const moduleCard = page.locator(".plugin-card").filter({ hasText: "Normalize names" });
  await moduleCard.getByRole("button", { name: "Resolve safely" }).click();
  const openMode = page.getByRole("region", { name: "Open Mode resolution" });
  await expect(openMode).toContainText("cannot express this transformation");
  await openMode.getByRole("button", { name: "Build confined module" }).click();
  await expect(moduleCard.getByText("active", { exact: true })).toBeVisible();
  await expect(moduleCard).toContainText("Implementation: verified");
  await expect(openMode).toContainText("registration: passed");

  await page.getByRole("button", { name: "Design", exact: true }).click();
  const current = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const pluginRegistration = await register({ scope: "global", kind: "plugin", name: "Signed delivery", generalizedIntent: "Sign and deliver documents across Kyro projects", inputs: ["document"], outputs: ["delivery"], permissions: ["network"], dependencies: ["PDF package"], validationTests: ["Rejects missing credentials"], activation: "explicit_review", effects: ["network", "dependency"], platforms: ["web"] });
  expect(pluginRegistration.status, JSON.stringify(pluginRegistration.body)).toBe(202);
  expect(current.revision).toBeGreaterThan(state.revision);
  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  const pluginCard = page.locator(".plugin-card").filter({ hasText: "Signed delivery" });
  await pluginCard.getByRole("button", { name: "Resolve safely" }).click();
  await openMode.getByRole("button", { name: "Keep explicit limitation" }).click();
  await expect(page.locator(".feedback")).toContainText("did not simulate or install anything");
  await expect(pluginCard.getByText("draft", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: new RegExp(projectName) }).click();
  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  await expect(page.locator(".plugin-card").filter({ hasText: "Normalize names" }).getByText("active", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/open-mode-verified-module.png", fullPage: true });
});
