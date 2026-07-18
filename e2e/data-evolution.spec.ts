import { expect, test } from "@playwright/test";

test("un utente evolve lo schema e collega due entità senza codice", async ({ page }) => {
  const projectName = `Dati collegati ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(projectName);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();

  await page.getByLabel("Nome", { exact: true }).fill("Clienti");
  await page.getByLabel("Collezione", { exact: true }).fill("clients");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await expect(page.getByRole("region", { name: "Evoluzione sorgente dati" })).toContainText("Schema v1");

  await page.getByLabel("Nome", { exact: true }).fill("Progetti");
  await page.getByLabel("Collezione", { exact: true }).fill("projects");
  await page.getByRole("button", { name: "+ Aggiungi campo" }).click();
  await page.getByLabel("Nome campo", { exact: true }).last().fill("clientId");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  const evolution = page.getByRole("region", { name: "Evoluzione sorgente dati" });
  await evolution.getByLabel("Campo locale relazione").selectOption("clientId");
  await evolution.getByLabel("Sorgente relazione").selectOption({ label: "Clienti" });
  await evolution.getByLabel("Campo destinazione relazione").selectOption("id");
  await evolution.getByRole("button", { name: "Crea relazione" }).click();
  await expect(evolution).toContainText("clientId → Clienti.id · uno");

  await evolution.getByRole("button", { name: "+ Nuovo campo" }).click();
  await evolution.getByLabel("Nome campo schema esistente").last().fill("budget");
  await evolution.getByLabel("Tipo campo esistente budget").selectOption("number");
  await evolution.getByRole("button", { name: "Salva nuova versione" }).click();
  await expect(page.getByText("Schema aggiornato alla versione 2. I record esistenti restano disponibili.")).toBeVisible();
  await expect(evolution).toContainText("Schema v2");
  await evolution.getByText("Cronologia schema").click();
  await expect(evolution).toContainText("Versione 2");
  await page.screenshot({ path: "artifacts/frontend-editor-data-relations.png", fullPage: true });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: /Progetti/ }).click();
  await expect(page.getByRole("region", { name: "Evoluzione sorgente dati" })).toContainText("Schema v2");
  await expect(page.getByRole("region", { name: "Evoluzione sorgente dati" })).toContainText("clientId → Clienti.id · uno");
});
