import { expect, test } from "@playwright/test";

test("utente Canva riordina i livelli prima e dopo con drag and drop", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Canva Layer Reorder");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();

  const paletteButton = page.locator(".palette").getByRole("button").filter({ hasText: "Button" });
  const componentIds: string[] = [];
  for (const name of ["Uno", "Due", "Tre"]) {
    await paletteButton.click();
    await page.getByLabel("Element name").fill(name);
    componentIds.push((await page.locator(".canvas-component.selected").getAttribute("data-component-id"))!);
  }

  const topLayers = page.locator(".layers > [role=treeitem] > button").filter({ hasText: /Uno|Due|Tre/ });
  await expect(topLayers).toHaveText([/Uno$/, /Due$/, /Tre$/]);
  const uno = topLayers.filter({ hasText: "Uno" });
  const tre = topLayers.filter({ hasText: "Tre" });
  const unoBox = (await uno.boundingBox())!;
  await tre.dragTo(uno, { targetPosition: { x: unoBox.width / 2, y: unoBox.height * 0.1 } });
  await expect(topLayers).toHaveText([/Tre$/, /Uno$/, /Due$/]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(topLayers).toHaveText([/Uno$/, /Due$/, /Tre$/]);
  const treBox = (await tre.boundingBox())!;
  await uno.dragTo(tre, { targetPosition: { x: treBox.width / 2, y: treBox.height * 0.8 } });
  await expect(topLayers).toHaveText([/Due$/, /Tre$/, /Uno$/]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(topLayers).toHaveText([/Uno$/, /Due$/, /Tre$/]);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(topLayers).toHaveText([/Due$/, /Tre$/, /Uno$/]);
  await page.screenshot({ path: "artifacts/frontend-editor-canva-layer-reorder.png", fullPage: true });

  await page.getByRole("button", { name: "Preview" }).click();
  const previewButtons = page.frameLocator('iframe[title="Preview isolata"]').getByRole("button");
  await expect(previewButtons).toHaveText(["Add", "Add", "Add"]);
  const ids = await previewButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-component")));
  expect(ids).toEqual([componentIds[1], componentIds[2], componentIds[0]]);
  await expect(page.getByText("Saved automatically")).toBeVisible();
});
