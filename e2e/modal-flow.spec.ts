import { expect, test } from "@playwright/test";

test("un utente chiude una modal con un nodo configurato visualmente", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`Modal visuale ${Date.now()}`);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list", "modal"]) await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  const nodePalette = page.getByRole("complementary", { name: "Aggiungi nodi al flow" });
  await nodePalette.getByLabel("Cerca azione").fill("Gestisci modal");
  await nodePalette.getByRole("button", { name: "Gestisci modal", exact: true }).click();
  await page.getByLabel("Elemento collegato").selectOption({ label: "Modal · modal" });
  await page.getByLabel("Azione modal").selectOption("close");
  const eventNode = page.locator(".react-flow__node").filter({ hasText: "Click pulsante" });
  await eventNode.click({ force: true });
  await page.getByLabel("Passo successivo").selectOption({ label: "Gestisci modal" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  const dialog = preview.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(dialog).toBeHidden();
  await page.screenshot({ path: "artifacts/frontend-editor-modal-flow.png", fullPage: true });
});
