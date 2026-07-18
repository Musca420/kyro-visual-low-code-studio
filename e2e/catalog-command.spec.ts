import { expect, test } from "@playwright/test";

test("template multipagina, ricerca componenti e comandi rapidi sono visuali", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Nome progetto")
    .fill(`Portfolio visuale ${Date.now()}`);
  await page.getByPlaceholder("Cerca template…").fill("portfolio");
  await page.locator(".template").filter({ hasText: "Portfolio" }).click();

  await expect(
    page.locator(".page-list button").filter({ hasText: "Home" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Progetti" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Profilo" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Contatti" }),
  ).toBeVisible();

  await page.getByPlaceholder("Cerca componenti…").fill("grafico");
  await expect(
    page.locator(".palette button").filter({ hasText: "chart" }),
  ).toBeVisible();
  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("Cosa vuoi fare?").fill("aggiungi chart");
  await page
    .locator(".command-results button")
    .filter({ hasText: "Aggiungi chart" })
    .click();
  await expect(
    page
      .locator(".design-canvas [data-component-id]")
      .filter({ hasText: "chart" }),
  ).toBeVisible();

  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("Cosa vuoi fare?").fill("preview");
  await page
    .locator(".command-results button")
    .filter({ hasText: "Apri Preview" })
    .click();
  await expect(page.getByTitle("Preview isolata")).toBeVisible();
  await page.screenshot({ path: "artifacts/template-catalog-command.png", fullPage: true });
});
