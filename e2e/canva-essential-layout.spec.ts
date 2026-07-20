import { expect, test } from "@playwright/test";

test("utente Canva crea righe e colonne responsive dalla modalità essenziale", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Canva Essential Layout");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  await palette.getByRole("button").filter({ hasText: /Section/ }).click();

  const section = page.getByTestId("component-container");
  const zone = section.locator(":scope > .component-children");
  const card = palette.getByRole("button").filter({ hasText: "card" });
  for (let index = 0; index < 3; index += 1) {
    const box = (await zone.boundingBox())!;
    await card.dragTo(zone, { targetPosition: { x: 14 + index * 28, y: box.height - 6 } });
    await expect(zone.locator(":scope > [data-component-id]")).toHaveCount(index + 1);
  }
  await section.locator(":scope > .component-tag").click();

  const quickLayout = page.getByRole("region", { name: "Content layout" });
  await quickLayout.getByRole("button", { name: "Quick grid 2" }).click();
  await quickLayout.getByLabel("Quick gap between elements").fill("24");
  await quickLayout.getByRole("button", { name: "Align content: Center" }).click();
  await expect(zone).toHaveCSS("display", "grid");
  expect((await zone.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(2);
  await expect(zone).toHaveCSS("gap", "24px");
  await expect(zone).toHaveCSS("align-items", "center");
  await page.screenshot({ path: "artifacts/frontend-editor-canva-essential-layout-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "mobile" }).click();
  await quickLayout.getByRole("button", { name: "Content in a column" }).click();
  await quickLayout.getByLabel("Quick gap between elements").fill("32");
  await expect(zone).toHaveCSS("display", "flex");
  await expect(zone).toHaveCSS("flex-direction", "column");
  await expect(zone).toHaveCSS("gap", "32px");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(zone).toHaveCSS("gap", "12px");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(zone).toHaveCSS("gap", "32px");
  await page.screenshot({ path: "artifacts/frontend-editor-canva-essential-layout-mobile.png", fullPage: true });

  const componentId = await section.getAttribute("data-component-id");
  await page.getByRole("button", { name: "Preview" }).click();
  const previewZone = page.frameLocator('iframe[title="Preview isolata"]').locator(`[data-component="${componentId}"]`);
  await expect(previewZone).toHaveCSS("display", "flex");
  await expect(previewZone).toHaveCSS("flex-direction", "column");
  await page.getByRole("button", { name: "desktop" }).click();
  await expect(previewZone).toHaveCSS("display", "grid");
  expect((await previewZone.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).split(" ")).toHaveLength(2);

  await page.getByRole("button", { name: "Design" }).click();
  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: /Canva Essential Layout/ }).click();
  await page.getByTestId("component-container").locator(":scope > .component-tag").click();
  await page.getByRole("button", { name: "mobile" }).click();
  await expect(page.getByRole("region", { name: "Content layout" }).getByRole("button", { name: "Content in a column" })).toHaveClass(/active/);
});
