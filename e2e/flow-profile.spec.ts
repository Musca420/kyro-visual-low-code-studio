import { expect, test } from "@playwright/test";

test("misura i nodi e conserva la cronologia flow alla riapertura", async ({ page }) => {
  const projectName = `Profiling visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(projectName);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.getByRole("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Misura questo flow");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.locator(".log-step").first().locator("time")).toContainText("ms");
  await page.locator(".flow-run-history summary").click();
  await expect(page.locator(".flow-run-history")).toContainText("5 passi");
  await page.screenshot({ path: "artifacts/frontend-editor-flow-profile.png", fullPage: true });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.locator(".flow-run-history summary").click();
  await expect(page.locator(".flow-run-history")).toContainText("5 passi");
  await page.locator(".flow-run-history button").first().click();
  await expect(page.locator(".log-console")).toContainText("Click pulsante: completato");
});
