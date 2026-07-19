import { expect, test } from "@playwright/test";

test("utente Canva ridimensiona i pannelli con mouse e tastiera e conserva la scelta", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Canva Resizable Panels");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();

  const left = page.getByRole("separator", { name: "Ridimensiona pannello elementi" });
  const right = page.getByRole("separator", { name: "Ridimensiona pannello proprietà" });
  await expect(left).toHaveAttribute("aria-valuenow", "240");
  await expect(right).toHaveAttribute("aria-valuenow", "300");

  await left.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(left).toHaveAttribute("aria-valuenow", "264");
  await right.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(right).toHaveAttribute("aria-valuenow", "316");

  const handle = (await left.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(left).toHaveAttribute("aria-valuenow", "304");
  const handleTop = (await left.boundingBox())!.y;
  await page.locator(".left-panel").evaluate((panel) => { panel.scrollTop = 400; });
  await expect(left).toBeVisible();
  expect(Math.abs((await left.boundingBox())!.y - handleTop)).toBeLessThan(2);
  await page.locator(".left-panel").evaluate((panel) => { panel.scrollTop = 0; });
  await page.screenshot({ path: "artifacts/frontend-editor-canva-resizable-panels.png", fullPage: true });

  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: /Canva Resizable Panels/ }).click();
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello elementi" })).toHaveAttribute("aria-valuenow", "304");
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello proprietà" })).toHaveAttribute("aria-valuenow", "316");

  await page.getByRole("separator", { name: "Ridimensiona pannello elementi" }).dblclick();
  await page.getByRole("separator", { name: "Ridimensiona pannello proprietà" }).dblclick();
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello elementi" })).toHaveAttribute("aria-valuenow", "240");
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello proprietà" })).toHaveAttribute("aria-valuenow", "300");

  await page.setViewportSize({ width: 760, height: 720 });
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello elementi" })).toBeHidden();
  await expect(page.getByRole("separator", { name: "Ridimensiona pannello proprietà" })).toBeHidden();
});
