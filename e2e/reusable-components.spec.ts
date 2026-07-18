import { expect, test } from "@playwright/test";

test("salva e riusa un blocco visuale come gruppo nativo modificabile", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Blocchi Canva");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();

  const palette = page.locator(".palette");
  await palette.getByRole("button").filter({ hasText: "card" }).click();
  await palette.getByRole("button", { name: /title$/ }).click();
  await page.getByTestId("component-card").click();
  await page.getByTestId("component-title").click({ modifiers: ["Control"] });
  await page.getByLabel("Nome blocco riutilizzabile").fill("Feature professionale");
  await page.getByRole("button", { name: "Salva selezione" }).click();
  await expect(page.getByText("Feature professionale salvato nei tuoi blocchi")).toBeVisible();

  const reusable = page.getByRole("button", { name: /Feature professionale 2 elementi/ });
  await reusable.click();
  await expect(page.getByTestId("component-reusable")).toBeVisible();
  await expect(page.getByTestId("component-reusable").getByTestId("component-title")).toBeVisible();
  await page.getByTestId("component-reusable").getByTestId("component-title").click();
  await page.getByLabel("Testo o etichetta").fill("Titolo della copia");
  await expect(page.getByTestId("component-reusable")).toContainText("Titolo della copia");

  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: /Blocchi Canva/ }).click();
  await expect(page.getByRole("button", { name: /Feature professionale 2 elementi/ })).toBeVisible();
  await expect(page.getByTestId("component-reusable")).toContainText("Titolo della copia");
  await page.screenshot({ path: "artifacts/frontend-editor-reusable-component.png", fullPage: true });
});
