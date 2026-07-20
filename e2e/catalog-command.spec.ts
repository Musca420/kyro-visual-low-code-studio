import { expect, test } from "@playwright/test";

test("template multipagina, ricerca componenti e comandi rapidi sono visuali", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Project name")
    .fill(`Portfolio visuale ${Date.now()}`);
  await page.getByPlaceholder("Search templates…").fill("portfolio");
  await page.locator(".template").filter({ hasText: "Portfolio" }).click();

  await expect(
    page.locator(".page-list button").filter({ hasText: "Home" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Projects" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Profile" }),
  ).toBeVisible();
  await expect(
    page.locator(".page-list button").filter({ hasText: "Contact" }),
  ).toBeVisible();

  await page.getByPlaceholder("Search components…").fill("chart");
  await expect(
    page.locator(".palette button").filter({ hasText: "chart" }),
  ).toBeVisible();
  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("What would you like to do?").fill("add chart");
  await page
    .locator(".command-results button")
    .filter({ hasText: "Add chart" })
    .click();
  await expect(
    page
      .locator(".design-canvas [data-component-id]")
      .filter({ hasText: "chart" }),
  ).toBeVisible();

  await page.keyboard.press("Control+K");
  await page.getByPlaceholder("What would you like to do?").fill("preview");
  await page
    .locator(".command-results button")
    .filter({ hasText: "Open Preview" })
    .click();
  await expect(page.getByTitle("Preview isolata")).toBeVisible();
  await page.screenshot({ path: "artifacts/template-catalog-command.png", fullPage: true });
});
