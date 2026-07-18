import { expect, test, type Page } from "@playwright/test";

const auditInteractiveNames = async (page: Page) =>
  page.locator("button,a,input,select,textarea,summary").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      })
      .filter((element) => {
        const id = element.getAttribute("id");
        const labelled = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const wrapped = element.closest("label");
        return !(
          element.getAttribute("aria-label")?.trim() ||
          element.getAttribute("aria-labelledby")?.trim() ||
          element.getAttribute("title")?.trim() ||
          element.textContent?.trim() ||
          (element instanceof HTMLInputElement && element.placeholder.trim()) ||
          labelled?.textContent?.trim() ||
          wrapped?.textContent?.trim()
        );
      })
      .map((element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className}`),
  );

test("home ed editor hanno nomi accessibili, focus visibile e percorso tastiera", async ({ page }) => {
  await page.goto("/");
  expect(await auditInteractiveNames(page)).toEqual([]);

  const focused: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    focused.push(await page.evaluate(() => {
      const element = document.activeElement as HTMLElement;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width <= 0 || box.height <= 0) throw new Error("Focus su controllo invisibile");
      if (style.outlineStyle === "none" && style.boxShadow === "none") throw new Error(`Focus non visibile su ${element.tagName}`);
      return element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName;
    }));
  }
  expect(new Set(focused).size).toBeGreaterThan(5);

  await page.getByLabel("Nome progetto").fill("Accessibility Visual Path");
  await page.getByRole("button", { name: "Landing page Hero, feature, CTA e footer" }).click();
  expect(await auditInteractiveNames(page)).toEqual([]);
  const canvasTitle = page.getByTestId("component-title").first();
  await canvasTitle.focus();
  await canvasTitle.press("Enter");
  await expect(canvasTitle).toHaveClass(/selected/);
  await page.setViewportSize({ width: 760, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
