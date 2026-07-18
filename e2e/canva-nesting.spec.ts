import { expect, test } from "@playwright/test";

test("utente Canva trascina elementi dentro e fuori dai contenitori", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Canva Visual Nesting");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  await palette.getByRole("button").filter({ hasText: "Sezione" }).click();
  await palette.getByRole("button").filter({ hasText: "Button" }).click();

  const section = page.getByTestId("component-container");
  const button = page.getByTestId("component-button");
  const sectionZone = section.locator(":scope > .component-children");
  const layerButton = page.locator(".layers > [role=treeitem]").filter({ hasText: "Button" }).locator(":scope > button");
  await layerButton.dragTo(sectionZone);
  await expect(sectionZone.locator(":scope > [data-component-id]")).toHaveCount(1);
  await expect(page.locator(".layers [role=treeitem][aria-level='2']").filter({ hasText: "Button" })).toHaveCount(1);
  await expect(button).toHaveCSS("position", "relative");
  await page.screenshot({ path: "artifacts/frontend-editor-canva-nesting.png", fullPage: true });

  const nestedLayerButton = page.locator(".layers [role=treeitem][aria-level='2']").filter({ hasText: "Button" }).locator(":scope > button");
  const canvas = page.locator(".design-canvas");
  const canvasBox = (await canvas.boundingBox())!;
  await nestedLayerButton.dragTo(canvas, { targetPosition: { x: canvasBox.width - 60, y: canvasBox.height - 80 } });
  await expect(sectionZone.locator(":scope > [data-component-id]")).toHaveCount(0);
  await expect(page.locator(".layers > [role=treeitem]").filter({ hasText: "Button" })).toHaveCount(1);

  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(sectionZone.locator(":scope > [data-component-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "Ripristina" }).click();
  await expect(sectionZone.locator(":scope > [data-component-id]")).toHaveCount(0);

  await page.locator(".layers > [role=treeitem]").filter({ hasText: "Button" }).locator(":scope > button").dragTo(sectionZone);
  const sectionId = await section.getAttribute("data-component-id");
  const buttonId = await button.getAttribute("data-component-id");
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  const previewSection = preview.locator(`[data-component="${sectionId}"]`);
  await expect(previewSection.locator(`[data-component="${buttonId}"]`)).toBeVisible();
  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
});
