import { expect, test } from "@playwright/test";

test("utente Canva aggiunge e ridimensiona colonne direttamente sul canvas", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Canva Flexible Columns");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "Colonne" }).click();

  await page.getByRole("button", { name: "Quattro colonne" }).click();
  await page.getByRole("button", { name: "Più colonne" }).click();
  await expect(page.getByLabel("Numero colonne")).toHaveText("5");

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
  await expect(page.getByLabel("Numero colonne")).toHaveText("5");
  await zone.hover();
  await expect(zone.getByRole("button", { name: /Ridimensiona colonne/ })).toHaveCount(4);
  const firstDivider = zone.getByRole("button", { name: "Ridimensiona colonne 1 e 2" });
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
  await page.getByRole("button", { name: "Annulla" }).click();
  expect(await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toBe(customColumns);
  await page.getByRole("button", { name: "Ripristina" }).click();
  expect(await zone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toBe(keyboardColumns);

  await page.getByRole("button", { name: "mobile" }).click();
  await page.getByRole("button", { name: "Due colonne" }).click();
  await expect(page.getByLabel("Numero colonne")).toHaveText("2");
  await page.getByRole("button", { name: "desktop" }).click();
  await expect(page.getByLabel("Numero colonne")).toHaveText("5");
  await zone.hover();
  await page.screenshot({ path: "artifacts/frontend-editor-canva-flexible-columns.png", fullPage: true });

  const componentId = await grid.getAttribute("data-component-id");
  await page.getByRole("button", { name: "Preview" }).click();
  const previewGrid = page.frameLocator('iframe[title="Preview isolata"]').locator(`[data-component="${componentId}"]`);
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(5);
  await page.getByRole("button", { name: "mobile" }).click();
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(2);

  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: /Canva Flexible Columns/ }).click();
  await page.getByTestId("component-grid").locator(":scope > .component-tag").click();
  await page.getByRole("button", { name: "desktop" }).click();
  await expect(page.getByLabel("Numero colonne")).toHaveText("5");
});
