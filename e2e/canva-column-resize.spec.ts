import { expect, test } from "@playwright/test";

test("utente Canva aggiunge e ridimensiona colonne direttamente sul canvas", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Canva Flexible Columns");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "Columns" }).click();

  await page.getByRole("button", { name: "Four columns" }).click();
  await page.getByRole("button", { name: "More columns" }).click();
  await expect(page.getByLabel("Column count")).toHaveText("5");

  const grid = page.getByTestId("component-grid");
  const zone = grid.locator(":scope > .component-children");
  const card = page.locator(".palette").getByRole("button").filter({ hasText: "card" });
  for (let index = 0; index < 5; index += 1) {
    const box = (await zone.boundingBox())!;
    await card.dragTo(zone, { targetPosition: { x: 12 + index * 24, y: box.height - 6 } });
    await expect(zone.locator(":scope > [data-component-id]")).toHaveCount(index + 1);
  }
  await grid.locator(":scope > .component-tag").click();
  await expect(zone.locator(":scope > [data-component-id]")).toHaveCount(5);
  await expect(page.getByLabel("Column count")).toHaveText("5");
  await zone.hover();
  await expect(zone.getByRole("button", { name: /Resize columns/ })).toHaveCount(4);
  const firstDivider = zone.getByRole("button", { name: "Resize columns 1 and 2" });
  const dividerBox = await firstDivider.boundingBox();
  expect(dividerBox).toBeTruthy();
  const dividerCenter = {
    x: dividerBox!.x + dividerBox!.width / 2,
    y: dividerBox!.y + dividerBox!.height / 2,
  };
  await page.mouse.move(dividerCenter.x, dividerCenter.y);
  await page.mouse.down();
  await page.mouse.move(dividerCenter.x + 70, dividerCenter.y, { steps: 8 });
  await page.mouse.up();

  const customColumns = await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns);
  expect(customColumns).toMatch(/fr .*fr/);
  expect(customColumns).not.toContain("repeat(");
  await firstDivider.focus();
  await page.keyboard.press("ArrowLeft");
  const keyboardColumns = await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns);
  expect(keyboardColumns).not.toBe(customColumns);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toBe(customColumns);
  await page.getByRole("button", { name: "Redo" }).click();
  expect(await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toBe(keyboardColumns);

  await page.getByRole("button", { name: "mobile" }).click();
  await page.getByRole("button", { name: "Two columns" }).click();
  await expect(page.getByLabel("Column count")).toHaveText("2");
  await page.getByRole("button", { name: "desktop" }).click();
  await expect(page.getByLabel("Column count")).toHaveText("5");
  await zone.hover();
  await page.screenshot({ path: "artifacts/frontend-editor-canva-flexible-columns.png", fullPage: true });

  const componentId = await grid.getAttribute("data-component-id");
  await page.getByRole("button", { name: "Preview" }).click();
  const previewGrid = page.frameLocator('iframe[title="Preview isolata"]').locator(`[data-component="${componentId}"]`);
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(5);
  await page.getByRole("button", { name: "mobile" }).click();
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(2);

  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: /Canva Flexible Columns/ }).click();
  await page.getByTestId("component-grid").locator(":scope > .component-tag").click();
  await page.getByRole("button", { name: "desktop" }).click();
  await expect(page.getByLabel("Column count")).toHaveText("5");
});
