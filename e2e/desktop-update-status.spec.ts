import { expect, test } from "@playwright/test";

test("the home clearly exposes a rejected desktop update", async ({ page }) => {
  await page.addInitScript(() => {
    window.frontendEditorDesktop = {
      platform: "win32",
      readWorkspace: async () => null,
      onOpenProject: () => () => undefined,
      getUpdateStatus: async () => ({ state: "rejected", message: "Invalid update signature" }),
      onUpdateStatus: () => () => undefined,
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Update rejected: Invalid update signature");
});
