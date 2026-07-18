import { expect, test } from "@playwright/test";

test("un utente salva un file locale con un flow costruito visualmente", async ({ page }) => {
  const projectName = `Archivio visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(projectName);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list", "upload"])
    await palette.locator("button").filter({ hasText: type }).click();

  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("File locali");
  await page.getByLabel("Collezione", { exact: true }).fill("assets");
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();

  const flowNodes = page.getByRole("navigation", { name: "Nodi del flow" });
  await flowNodes.getByRole("button", { name: "Click pulsante", exact: true }).click();
  await page.getByLabel("Tipo evento").selectOption("change");
  await page.getByLabel("Elemento collegato").selectOption({ label: "Upload · upload" });
  for (const label of ["Leggi input", "Non vuoto"]) {
    await flowNodes.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: "Elimina nodo" })).toBeVisible();
    await page.getByRole("button", { name: "Elimina nodo" }).click();
  }

  const nodePalette = page.getByRole("complementary", { name: "Aggiungi nodi al flow" });
  await nodePalette.getByLabel("Cerca azione").fill("Prepara file");
  await nodePalette.getByRole("button", { name: "Prepara file", exact: true }).click();
  await page.getByLabel("Dimensione massima file").fill("1");
  await page.getByLabel("Tipi file accettati").fill("image/*");
  await flowNodes.getByRole("button", { name: "Click pulsante", exact: true }).click();
  await page.getByLabel("Passo successivo").selectOption({ label: "Prepara file" });
  await flowNodes.getByRole("button", { name: "Prepara file", exact: true }).click();
  await page.getByLabel("Passo successivo").selectOption({ label: "Inserisci record" });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("upload").setInputFiles({ name: "aurora.png", mimeType: "image/png", buffer: Buffer.from("pixel") });
  await expect(page.locator(".log-console")).toContainText("Prepara file: completato");
  await expect(preview.getByText("aurora.png")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-file-storage.png", fullPage: true });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByText("aurora.png")).toBeVisible();
});
