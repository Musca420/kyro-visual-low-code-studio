import { _electron as electron, expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("la shell desktop apre una cartella esistente nel modello visuale", async ({ browserName }, testInfo) => {
  const fixture = resolve("e2e/fixtures/desktop-project");
  const application = await electron.launch({
    args: [
      "electron/main.cjs",
      "--project",
      fixture,
      `--user-data-dir=${testInfo.outputPath(`desktop-profile-${browserName}`)}`,
    ],
    env: {
      ...process.env,
      FRONTEND_EDITOR_DEV_URL: "http://127.0.0.1:4173",
      FRONTEND_EDITOR_WORKSPACE: fixture,
    },
  });
  try {
    const window = await application.firstWindow();
    await expect(window.locator(".project-title input")).toHaveValue("desktop-project", { timeout: 15_000 });
    await expect(window.getByText(/Imported source/)).toBeVisible();
    await expect(window.getByText("Studio Aurora", { exact: true }).first()).toBeVisible();
    await window.screenshot({ path: "artifacts/frontend-editor-desktop-import.png" });
    const security = await application.evaluate(({ BrowserWindow }) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return {
        contextIsolation: preferences.contextIsolation,
        nodeIntegration: preferences.nodeIntegration,
        sandbox: preferences.sandbox,
      };
    });
    expect(security).toEqual({ contextIsolation: true, nodeIntegration: false, sandbox: true });
  } finally {
    await application.close();
  }
});
