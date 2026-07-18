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
  await expect(grid).toHaveCSS("left", "32px");
  await expect(grid).toHaveCSS("top", "24px");

  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(grid).toHaveCSS("left", "0px");
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(grid).toHaveCSS("left", "32px");
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

test("multiselezione allinea, distribuisce e sposta un gruppo senza codice", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Canva Multi Select");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const paletteButton = page.locator(".palette").getByRole("button").filter({ hasText: "button" });
  for (const [x, y] of [[16, 0], [152, 40], [336, 80]]) {
    await paletteButton.click();
    await page.locator(".right-panel").getByRole("button", { name: "Avanzata" }).click();
    await page.getByLabel("Larghezza").fill("120px");
    await page.getByLabel("Posizione X").fill(`${x}px`);
    await page.getByLabel("Posizione Y").fill(`${y}px`);
  }

  const buttons = page.getByTestId("component-button");
  await expect(buttons).toHaveCount(3);
  const buttonIds = await buttons.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-component-id")!),
  );
  await buttons.nth(0).click();
  await buttons.nth(1).click({ modifiers: ["Control"] });
  await buttons.nth(2).click({ modifiers: ["Control"] });
  await expect(page.getByLabel("Disponi 3 elementi selezionati")).toBeVisible();

  await page.getByRole("button", { name: "Allinea in alto" }).click();
  await page.waitForTimeout(250);
  const alignedTops = await buttons.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().top)),
  );
  expect(Math.max(...alignedTops) - Math.min(...alignedTops)).toBeLessThanOrEqual(8);

  await page.getByRole("button", { name: "Distribuisci orizzontalmente" }).click();
  await page.waitForTimeout(250);
  const distributed = await buttons.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect()).sort((a, b) => a.left - b.left),
  );
  const firstGap = distributed[1].left - distributed[0].right;
  const secondGap = distributed[2].left - distributed[1].right;
  expect(Math.abs(firstGap - secondGap)).toBeLessThanOrEqual(8);

  const beforeMove = await buttons.evaluateAll((items) =>
    items.map((item) => ({ left: item.getBoundingClientRect().left, top: item.getBoundingClientRect().top })),
  );
  const mover = buttons.nth(0).getByRole("button", { name: "Trascina per spostare" });
  await mover.hover();
  const moverBox = await mover.boundingBox();
  await page.mouse.down();
  await page.mouse.move(
    moverBox!.x + moverBox!.width / 2 + 32,
    moverBox!.y + moverBox!.height / 2 + 24,
    { steps: 4 },
  );
  await page.mouse.up();
  await page.waitForTimeout(250);
  const afterMove = await buttons.evaluateAll((items) =>
    items.map((item) => ({ left: item.getBoundingClientRect().left, top: item.getBoundingClientRect().top })),
  );
  afterMove.forEach((box, index) => {
    expect(Math.round(box.left - beforeMove[index].left)).toBe(32);
    expect(Math.round(box.top - beforeMove[index].top)).toBe(24);
  });
  await expect(page.getByLabel("Disponi 3 elementi selezionati")).toBeVisible();
  await page.mouse.move(800, 620);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/frontend-editor-canva-multiselect.png", fullPage: true });

  await page.getByRole("button", { name: "Annulla" }).click();
  await page.waitForTimeout(250);
  const afterUndo = await buttons.evaluateAll((items) =>
    items.map((item) => ({ left: item.getBoundingClientRect().left, top: item.getBoundingClientRect().top })),
  );
  afterUndo.forEach((box, index) => {
    expect(Math.round(box.left)).toBe(Math.round(beforeMove[index].left));
    expect(Math.round(box.top)).toBe(Math.round(beforeMove[index].top));
  });
  await page.getByRole("button", { name: "Ripristina" }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  const previewBoxes = await Promise.all(
    buttonIds.map((id) =>
      preview.locator(`[data-component="${id}"]`).evaluate((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, position: getComputedStyle(element).position };
      }),
    ),
  );
  expect(previewBoxes.every((box) => box.position === "absolute")).toBe(true);
  expect(Math.max(...previewBoxes.map((box) => box.top)) - Math.min(...previewBoxes.map((box) => box.top))).toBeLessThanOrEqual(8);
});
