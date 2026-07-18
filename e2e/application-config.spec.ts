import { expect, test } from "@playwright/test";

test("configura accesso, ruoli, offline e aggiornamenti senza salvare segreti", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Nome progetto")
    .fill(`Gestionale configurato ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Gestionale" }).click();
  await page.getByRole("button", { name: "Pubblica" }).click();
  await page.getByLabel("Chi può entrare?").selectOption("generated");
  await expect(page.getByRole("alert")).toContainText("Manca il backend");
  await expect(page.getByText("AUTH_SECRET")).toBeVisible();
  await page.getByLabel("Conserva una base offline").check();
  await page.getByLabel("Aggiornamento automatico").selectOption("sse");
  await expect(page.getByLabel("Canale aggiornamenti")).toHaveValue(
    "http://127.0.0.1:8787/events",
  );
  await page.getByLabel("Può solo vedere").uncheck();

  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByLabel("Genera anche il backend").check();
  await page.getByLabel("Nome", { exact: true }).fill("Backend gestionale");
  await page.getByLabel("Collezione", { exact: true }).fill("records");
  await page
    .getByRole("button", { name: "Configura backend generato" })
    .click();
  await page.getByRole("button", { name: "Pubblica" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(/non vengono mai salvati/)).toBeVisible();
});
