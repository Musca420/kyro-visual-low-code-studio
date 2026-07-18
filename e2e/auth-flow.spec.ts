import { expect, test } from "@playwright/test";

test("un utente protegge un'azione per ruolo dal flow visuale", async ({ page }) => {
  const name = `Accesso visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(name);
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"]) await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Dati", exact: true }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Aggiungi nodi al flow" });
  await nodePalette.getByLabel("Cerca azione").fill("Controlla ruolo");
  await nodePalette.getByRole("button", { name: "Controlla ruolo", exact: true }).click();
  await page.getByLabel("Ruoli ammessi").fill("admin,editor");
  await page.getByLabel("Ruolo simulato preview").selectOption("viewer");
  await page.getByLabel("Messaggio accesso negato").fill("Solo il team può aggiungere attività");
  const roleNode = page.locator(".react-flow__node").filter({ hasText: "Controlla ruolo" });
  const eventNode = page.locator(".react-flow__node").filter({ hasText: "Click pulsante" });
  await eventNode.click();
  await page.getByLabel("Passo successivo").selectOption({ label: "Controlla ruolo" });
  await roleNode.click();
  await page.getByLabel("Uscita da collegare").selectOption("success");
  await page.getByLabel("Passo successivo").selectOption({ label: "Leggi input" });
  await page.getByLabel("Uscita da collegare").selectOption("error");
  await page.getByLabel("Passo successivo").selectOption({ label: "Mostra errore" });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  let preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Task protetto");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(page.locator(".log-console")).toContainText("Solo il team può aggiungere attività");
  await expect(preview.getByRole("alert")).toContainText("Solo il team può aggiungere attività");

  await page.getByRole("button", { name: /^Flow/ }).click();
  await roleNode.click();
  await page.getByLabel("Ruolo simulato preview").selectOption("editor");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Task protetto");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(preview.getByText("Task protetto")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-auth-flow.png", fullPage: true });
});
