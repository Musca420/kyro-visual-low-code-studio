import { _electron as electron, expect, test } from "@playwright/test";
import { resolve } from "node:path";

test.setTimeout(90_000);

test("the shell starts its local renderer and bridge without external services", async ({ browserName }, testInfo) => {
  const fixture = resolve("e2e/fixtures/desktop-project");
  const application = await electron.launch({
    args: [
      "electron/main.cjs",
      "--project",
      fixture,
      `--user-data-dir=${testInfo.outputPath(`production-profile-${browserName}`)}`,
    ],
    env: { ...process.env, FRONTEND_EDITOR_WORKSPACE: fixture },
  });
  try {
    const window = await application.firstWindow();
    expect(window.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+/);
    await expect(window.getByLabel("Project name")).toHaveValue("desktop-project", { timeout: 45_000 });
    await expect(window.getByText("Studio Aurora", { exact: true }).first()).toBeVisible();
    await expect.poll(() => window.evaluate(() => fetch("/api/codex/status").then((response) => response.status))).toBe(200);
    await window.screenshot({ path: "artifacts/frontend-editor-desktop-production.png" });
  } finally {
    await application.close();
  }
});
