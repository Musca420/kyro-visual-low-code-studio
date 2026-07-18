import { expect, test } from "@playwright/test";

test("la preview porta console ed errori runtime nel pannello visuale", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Osservabilità ${Date.now()}`);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.locator('iframe[title="Preview isolata"]');
  await expect(frame).toBeVisible();
  await page.frameLocator('iframe[title="Preview isolata"]').locator("body").evaluate(() => console.error("Immagine non caricata", { componentId: "hero-image" }));
  await expect(page.locator(".log-console")).toContainText("Immagine non caricata");
  await expect(page.locator(".log-console")).toContainText("hero-image");
  await page.screenshot({ path: "artifacts/frontend-editor-runtime-console.png", fullPage: true });
});
