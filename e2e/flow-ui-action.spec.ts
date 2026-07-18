import { expect, test } from "@playwright/test";

test("un flow cambia davvero un elemento della preview senza codice", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(`UI visuale ${Date.now()}`);
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
  await nodePalette.getByLabel("Cerca azione").fill("Cambia elemento");
  await nodePalette.getByRole("button", { name: "Cambia elemento", exact: true }).click();
  await page.getByLabel("Nome nodo").fill("Conferma visiva");
  await page.getByLabel("Elemento da cambiare").selectOption({ label: "Button · button" });
  await page.getByLabel("Cambiamento elemento").selectOption("text");
  await page.getByLabel("Valore cambiamento").fill("Aggiunta completata");
  const refresh = page.locator(".react-flow__node").filter({ hasText: "Aggiorna lista" });
  const visual = page.locator(".react-flow__node").filter({ hasText: "Conferma visiva" });
  await page.getByRole("button", { name: "Mostra tutto" }).click();
  const edgeCount = await page.locator(".react-flow__edge").count();
  const sourceBox = (await refresh.locator(".react-flow__handle.source").boundingBox())!;
  const targetBox = (await visual.locator(".react-flow__handle.target").boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(edgeCount + 1);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Azione grafica");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(preview.getByRole("button", { name: "Aggiunta completata" })).toBeVisible();
  await expect(page.locator(".log-console")).toContainText("Conferma visiva: completato");
  await page.screenshot({ path: "artifacts/frontend-editor-flow-ui-action.png", fullPage: true });
});
