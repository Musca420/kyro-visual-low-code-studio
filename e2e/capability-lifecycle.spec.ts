import { expect, test } from "@playwright/test";

test("versiona una capability globale senza attivarla prima delle prove", async ({ page, request }) => {
  const projectName = `Capability lifecycle ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");
  const state = await (await request.get(`/api/live/status?projectId=${projectId}`)).json();
  const proposal = {
    scope: "global", kind: "typed_module", name: "Normalize contact data",
    generalizedIntent: "Normalize contact fields for every Kyro project",
    inputs: ["contact"], outputs: ["normalized contact"], permissions: [], dependencies: [],
    validationTests: ["Normalizes whitespace", "Preserves missing fields"], activation: "passing_tests",
    effects: ["data"], platforms: ["web", "android"],
  };
  const register = (args: typeof proposal) => page.evaluate(async ({ projectId, pageId, revision, args }) => {
    const response = await fetch("/api/live/tools/register_global_capability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, pageId, revision, args }) });
    return { status: response.status, body: await response.json() };
  }, { projectId, pageId: state.pageId, revision: state.revision, args });
  await expect(register(proposal)).resolves.toMatchObject({ status: 202 });
  await expect(register({ ...proposal, outputs: ["normalized contact", "warnings"] })).resolves.toMatchObject({ status: 202 });

  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  const registry = page.locator(".settings-section").filter({ has: page.getByRole("heading", { name: "Global capabilities" }) });
  await expect(registry.getByText("Normalize contact data", { exact: true })).toHaveCount(2);
  await expect(registry.getByText("typed module · v0.1.0 · global", { exact: true })).toBeVisible();
  await expect(registry.getByText("typed module · v0.2.0 · global", { exact: true })).toBeVisible();
  await expect(registry.getByText(/Implementation: missing/).first()).toBeVisible();
  await expect(registry.getByText(/Migration from v0\.1\.0: blocked · rollback v0\.1\.0/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(projectName) }).click();
  await page.getByRole("button", { name: "Extensions", exact: true }).click();
  await expect(page.getByText("typed module · v0.2.0 · global", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/capability-version-lifecycle.png", fullPage: true });
});
