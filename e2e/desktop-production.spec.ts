import { _electron as electron, expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("la shell carica il renderer di produzione senza server Vite", async ({ browserName }, testInfo) => {
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
    expect(window.url()).toMatch(/^file:/);
    await expect(window.locator(".project-title input")).toHaveValue("desktop-project", { timeout: 15_000 });
    await expect(window.getByText("Studio Aurora", { exact: true }).first()).toBeVisible();
    await window.screenshot({ path: "artifacts/frontend-editor-desktop-production.png" });
  } finally {
    await application.close();
  }
});

