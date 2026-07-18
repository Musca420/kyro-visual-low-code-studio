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

  await nodePalette.getByRole("button", { name: "Salva stato" }).click();
  await page.getByLabel("Nome stato").fill("ricerca");
  await nodePalette.getByRole("button", { name: "Componi testo" }).click();
  await page.getByLabel("Formato testo").fill("Risultato: {{value}}");
  await nodePalette.getByRole("button", { name: "Attendi" }).click();
  await page.getByLabel("Durata attesa").fill("250");
  await nodePalette.getByRole("button", { name: "Chiama API" }).click();
  await page.getByLabel("Indirizzo API").fill("https://api.example.test/items");
  await page.getByLabel("Metodo API").selectOption("POST");
  await page.getByLabel("Corpo richiesta API").fill('{"name":"{{value}}"}');
  await expect(page.getByText("Nessuna password viene salvata qui")).toBeVisible();
  await nodePalette.getByRole("button", { name: "Trasforma elenco" }).click();
  await page.getByLabel("Campo trasformazione").fill("name");
  await page.getByLabel("Formato trasformazione").fill("Progetto: {{value}}");
  await nodePalette.getByRole("button", { name: "Limita input rapidi" }).click();
  await page.getByLabel("Durata debounce").fill("350");
  await nodePalette.getByRole("button", { name: "Scegli percorso" }).click();
  await page.getByLabel("Casi scelta").fill("nuovo,in corso,completato");
  const switchNode = page.locator(".react-flow__node").filter({ hasText: "Scegli percorso" });
  await expect(switchNode.locator('[title="in corso"]')).toBeVisible();
  await nodePalette.getByRole("button", { name: "Mostra notifica" }).click();
  await page.getByLabel("Nome nodo").fill("Caso in corso");
  const caseEdge = page.locator(".react-flow__edge-text").filter({ hasText: "case:in corso" });
  for (let attempt = 0; attempt < 3 && await caseEdge.count() === 0; attempt += 1) {
    await switchNode.locator('[title="in corso"]').dragTo(page.locator(".react-flow__node").filter({ hasText: "Caso in corso" }).locator(".react-flow__handle.target"));
    await page.waitForTimeout(150);
  }
  await expect(caseEdge).toBeVisible();
  await nodePalette.getByRole("button", { name: "Per ogni elemento" }).click();
  await page.getByLabel("Limite ciclo").fill("25");
  const loopNode = page.locator(".react-flow__node").filter({ hasText: "Per ogni elemento" });
  await expect(loopNode.locator('[title="Ogni elemento"]')).toBeVisible();
  await expect(loopNode.locator('[title="Completato"]')).toBeVisible();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Salva stato" })).toBeVisible();
  await expect(page.locator(".react-flow__node").filter({ hasText: "Componi testo" })).toContainText("unknown → string");
  await page.screenshot({ path: "artifacts/frontend-editor-flow-state.png", fullPage: true });
});
