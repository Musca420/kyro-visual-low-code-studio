import { expect, test } from "@playwright/test";

test("spiega un servizio esterno e lascia la scelta all'utente", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Resolver guidato");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "button" }).click();
  await page.getByTestId("component-button").click();
  await page.getByText("Significato nel programma").click();
  await page.getByLabel("Risultato atteso", { exact: true }).fill("completa pagamento checkout");

  const issue = page.locator(".capability-issues article").filter({ hasText: "Provider di pagamento necessario" });
  await expect(issue).toBeVisible();
  await issue.getByText("Confronta le soluzioni").click();
  await expect(issue).toContainText("Chiave pubblica nel client e segreto soltanto nel backend");
  await expect(issue).toContainText("Link di pagamento ospitato: percorso più semplice");
  await expect(issue).toContainText("commissioni");
  await expect(issue).toContainText("senza la tua conferma");
  await page.mouse.move(600, 700);
  await page.screenshot({ path: "artifacts/frontend-editor-capability-plan.png", fullPage: true });
});
