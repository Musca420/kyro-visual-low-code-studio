import { expect, test } from "@playwright/test";

test("canvas visuale crea colonne responsive e usa maniglie con snapping e undo", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Canva Canvas");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  await palette.getByRole("button").filter({ hasText: "Colonne" }).click();
  const grid = page.getByTestId("component-grid");
  await expect(grid).toBeVisible();
  await page.getByRole("button", { name: "Tre colonne" }).click();
  const dropZone = grid.locator(":scope > .component-children");
  await expect(dropZone).toHaveCSS("display", "grid");
  expect(await dropZone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toContain("repeat(3");
  const card = palette.getByRole("button").filter({ hasText: "card" });
  const dropBox = await dropZone.boundingBox();
  await card.dragTo(dropZone, { targetPosition: { x: 24, y: dropBox!.height - 12 } });
  await card.dragTo(dropZone, { targetPosition: { x: dropBox!.width / 2, y: dropBox!.height - 12 } });
  await card.dragTo(dropZone, { targetPosition: { x: dropBox!.width - 24, y: dropBox!.height - 12 } });
  await expect(grid.locator(':scope > .component-children > [data-component-id]')).toHaveCount(3);
  await grid.locator(":scope > .component-tag").click();

  await page.getByRole("button", { name: "mobile" }).click();
  await page.getByRole("button", { name: "Una colonna" }).click();
  expect(await dropZone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toContain("repeat(1");
  await page.getByRole("button", { name: "desktop" }).click();
  expect(await dropZone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toContain("repeat(3");

  await grid.scrollIntoViewIfNeeded();
  const before = await grid.boundingBox();
  const corner = grid.getByRole("button", { name: "Ridimensionamento libero" });
  await corner.hover();
  const cornerBox = await corner.boundingBox();
  expect(before && cornerBox).toBeTruthy();
  await page.mouse.down();
  await page.mouse.move(cornerBox!.x + cornerBox!.width / 2 + 96, cornerBox!.y + cornerBox!.height / 2 + 64, { steps: 6 });
  await expect(grid.locator(".alignment-guide")).toHaveCount(2);
  await page.mouse.up();
  const resized = await grid.boundingBox();
  expect(resized!.width).toBeGreaterThan(before!.width + 40);
  expect(resized!.height).toBeGreaterThan(before!.height + 40);

  const mover = grid.getByRole("button", { name: "Trascina per spostare" });
  await mover.hover();
  const moverBox = await mover.boundingBox();
  await page.mouse.down();
  await page.mouse.move(moverBox!.x + moverBox!.width / 2 + 32, moverBox!.y + moverBox!.height / 2 + 24, { steps: 4 });
  await expect(grid.locator(".alignment-guide")).toHaveCount(2);
  await page.screenshot({ path: "artifacts/frontend-editor-canva-guides.png", fullPage: true });
  await page.mouse.up();
  await expect(grid).toHaveCSS("margin-left", "32px");
  await expect(grid).toHaveCSS("margin-top", "24px");

  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(grid).toHaveCSS("margin-left", "0px");
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(grid).toHaveCSS("margin-left", "32px");
  await page.screenshot({ path: "artifacts/frontend-editor-canva-columns.png", fullPage: true });

  const componentId = await grid.getAttribute("data-component-id");
  await page.getByRole("button", { name: "Preview" }).click();
  const previewGrid = page
    .frameLocator('iframe[title="Preview isolata"]')
    .locator(`[data-component="${componentId}"]`);
  await expect(previewGrid).toHaveCSS("display", "grid");
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(3);
  await page.getByRole("button", { name: "mobile" }).click();
  expect((await previewGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(1);
  await page.getByRole("button", { name: "desktop" }).click();
  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta app" }).click();
  await (await exportDownload).saveAs("artifacts/canva-canvas-export.zip");
  await page.getByRole("button", { name: "Design" }).click();

  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: /Canva Canvas/ }).click();
  const reopened = page.getByTestId("component-grid");
  const reopenedDropZone = reopened.locator(":scope > .component-children");
  expect(await reopenedDropZone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toContain("repeat(3");
  await page.getByRole("button", { name: "mobile" }).click();
  expect(await reopenedDropZone.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns)).toContain("repeat(1");
});
