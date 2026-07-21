import { expect, test } from "@playwright/test";

test("un utente configura pagina, indietro e sito esterno dal flow", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Navigazione visuale ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"]) await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  const nodePalette = page.getByRole("complementary", { name: "Add nodes to the flow" });
  await nodePalette.getByLabel("Search actions").fill("Navigate");
  await nodePalette.getByRole("button", { name: "Navigate", exact: true }).click();
  await page.getByLabel("Navigation type").selectOption("page");
  await page.getByLabel("Navigation path").fill("/destination");
  await page
    .getByRole("navigation", { name: "Flow steps" })
    .getByRole("button", { name: "Button click" })
    .click();
  await page.getByLabel("Next step").selectOption({ label: "Navigate" });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByRole("button", { name: "Add" }).click();
  await expect.poll(() => preview.locator("body").evaluate(() => location.hash)).toBe("#/destination");
  await page.getByRole("button", { name: /^Flow/ }).click();
  const navigationNode = page.locator(".react-flow__node").filter({ hasText: "Navigate" });
  await navigationNode.locator("strong").click();
  await expect(page.getByLabel("Navigation type")).toBeVisible();
  await page.getByLabel("Navigation type").selectOption("back");
  await expect(page.getByLabel("Navigation path")).toHaveCount(0);
  await page.getByLabel("Navigation type").selectOption("url");
  await page.getByLabel("Navigation path").fill("https://example.com");
  await page.screenshot({ path: "artifacts/frontend-editor-navigation-flow.png", fullPage: true });
});
