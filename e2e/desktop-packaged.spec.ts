import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

test("il pacchetto desktop si avvia indipendentemente e apre il progetto", async ({ browserName }, testInfo) => {
  test.skip(process.env.RUN_PACKAGED_DESKTOP !== "1", "Richiede prima npm run desktop:package");
  const executable = process.env.DESKTOP_EXECUTABLE
    ? resolve(process.env.DESKTOP_EXECUTABLE)
    : resolve("desktop-dist/FrontendEditor-win32-x64/frontend-editor.exe");
  test.skip(!existsSync(executable), "Pacchetto Windows non presente");
  const fixture = resolve("e2e/fixtures/desktop-project");
  const application = await electron.launch({
    executablePath: executable,
    args: ["--project", fixture, `--user-data-dir=${testInfo.outputPath(`packaged-profile-${browserName}`)}`],
  });
  try {
    const window = await application.firstWindow();
    await expect(window).toHaveTitle("Frontend Editor");
    await expect(window.locator(".project-title input")).toHaveValue("desktop-project", { timeout: 15_000 });
    await expect(window.getByText("Studio Aurora", { exact: true }).first()).toBeVisible();
    await window.screenshot({
      path: process.env.DESKTOP_EXECUTABLE
        ? "artifacts/frontend-editor-desktop-installed.png"
        : "artifacts/frontend-editor-desktop-packaged.png",
    });
  } finally {
    await application.close();
  }
});
