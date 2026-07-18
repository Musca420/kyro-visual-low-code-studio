import { expect, test } from "@playwright/test";

test("configura la lettura di un record per ID senza codice", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Get visuale");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.getByRole("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Aggiungi nodi al flow" });
  await nodePalette.getByLabel("Cerca azione").fill("Carica dati");
  await nodePalette.getByRole("button", { name: "Carica dati", exact: true }).click();
  await page.getByLabel("Sorgente collegata").selectOption({ label: "Attività locali" });
  await page.getByLabel("Tipo caricamento dati").selectOption("one");
  await page.getByLabel("ID record da caricare").fill("{{value}}");
  await page.getByLabel("Campo ID input").fill("projectId");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Carica dati" }).last()).toContainText("unknown → record");
  await expect(page.getByText(/prendere l’ID dal passo precedente/)).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-get-record.png", fullPage: true });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: /Get visuale/ }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.locator(".react-flow__node").filter({ hasText: "Carica dati" }).last().click();
  await expect(page.getByLabel("Tipo caricamento dati")).toHaveValue("one");
  await expect(page.getByLabel("Campo ID input")).toHaveValue("projectId");
});
