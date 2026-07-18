import { expect, test } from "@playwright/test";

test("un utente costruisce e configura nodi del flow senza codice", async ({ page }) => {
  const name = `Flow visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(name);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Aggiungi nodi al flow" });
  await nodePalette.getByRole("button", { name: "Carica dati" }).click();
  await expect(page.getByRole("complementary", { name: "Configura nodo selezionato" })).toContainText("Carica dati");
  await page.getByLabel("Nome nodo").fill("Carica attività recenti");
  await page.getByLabel("Sorgente collegata").selectOption({ label: "Attività locali" });
  const queryNode = page.locator(".react-flow__node").filter({ hasText: "Carica attività recenti" });
  const refreshNode = page.locator(".react-flow__node").filter({ hasText: "Aggiorna lista" });
  await expect(queryNode).toBeVisible();
  await refreshNode.locator(".react-flow__handle.source").dragTo(queryNode.locator(".react-flow__handle.target"));

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Provare il flow visuale");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.locator(".log-console")).toContainText("Carica attività recenti: completato");

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Carica attività recenti" }).click();
  await expect(page.getByLabel("Sorgente collegata")).toHaveValue(/.+/);
  await page.getByRole("complementary", { name: "Aggiungi nodi al flow" }).getByRole("button", { name: "Condizione" }).click();
  await page.getByLabel("Operatore condizione").selectOption("contains");
  await page.getByLabel("Valore condizione").fill("flow");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Condizione" })).toBeVisible();

  await nodePalette.getByRole("button", { name: "Funzione avanzata" }).click();
  await page.getByRole("button", { name: "Nuovo modulo protetto" }).click();
  await page.getByLabel("Operazione modulo").selectOption("uppercase");
  await page.getByLabel("Input test modulo").fill("canva");
  await page.getByLabel("Risultato atteso modulo").fill("CANVA");
  await page.getByRole("button", { name: "Esegui test" }).click();
  await expect(page.getByText("Test superato: CANVA")).toBeVisible();
  await page.getByRole("button", { name: "Prova ora" }).click();
  await expect(page.getByText("Output: CANVA")).toBeVisible();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Funzione avanzata" })).toContainText("string → string");
  await page.screenshot({ path: "artifacts/frontend-editor-protected-module.png", fullPage: true });
  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Funzione avanzata" }).click();
  await expect(page.getByLabel("Modulo collegato")).toHaveValue(/.+/);

  await queryNode.locator(".react-flow__handle.source").dragTo(page.locator(".react-flow__node").filter({ hasText: "Inserisci record" }).locator(".react-flow__handle.target"));
  await expect(page.getByRole("alert")).toContainText("produce list");
  await page.screenshot({ path: "artifacts/frontend-editor-flow-builder.png", fullPage: true });
});
