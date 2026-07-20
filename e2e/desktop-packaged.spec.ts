import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

test("the packaged Kyro app starts independently and exposes visual actions", async ({ browserName }, testInfo) => {
  test.skip(process.env.RUN_PACKAGED_DESKTOP !== "1", "Richiede prima npm run desktop:package");
  const executable = process.env.DESKTOP_EXECUTABLE
    ? resolve(process.env.DESKTOP_EXECUTABLE)
    : resolve("desktop-dist/Kyro-win32-x64/kyro.exe");
  test.skip(!existsSync(executable), "Windows package is not available");
  const fixture = resolve("e2e/fixtures/desktop-project");
  const application = await electron.launch({
    executablePath: executable,
    args: ["--project", fixture, `--user-data-dir=${testInfo.outputPath(`packaged-profile-${browserName}`)}`],
  });
  try {
    const window = await application.firstWindow();
    await expect(window).toHaveTitle("Kyro — Visual Low-Code Studio");
    await expect(window.getByLabel("Project name")).toHaveValue("desktop-project", { timeout: 45_000 });
    await expect(window.getByText("Studio Aurora", { exact: true }).first()).toBeVisible();
    await window.getByRole("button", { name: "Design" }).click();
    const canvasTitle = window.getByTestId("component-title").first();
    await canvasTitle.click();
    await window.getByRole("tab", { name: "Actions 0" }).click();
    await expect(window.getByText(/This element has no direct interaction events/)).toBeVisible();
    await expect(window.getByRole("button", { name: "Ask Codex" }).first()).toBeVisible();
    await window.screenshot({
      path: process.env.DESKTOP_EXECUTABLE
        ? "artifacts/kyro-desktop-installed.png"
        : "artifacts/kyro-desktop-packaged.png",
    });
  } finally {
    await application.close();
  }
});
