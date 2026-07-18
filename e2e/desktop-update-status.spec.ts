import { expect, test } from "@playwright/test";

test("la home espone chiaramente un aggiornamento desktop rifiutato", async ({ page }) => {
  await page.addInitScript(() => {
    window.frontendEditorDesktop = {
      platform: "win32",
      readWorkspace: async () => null,
      onOpenProject: () => () => undefined,
      getUpdateStatus: async () => ({ state: "rejected", message: "Firma aggiornamento non valida" }),
      onUpdateStatus: () => () => undefined,
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Aggiornamento rifiutato: Firma aggiornamento non valida");
});
