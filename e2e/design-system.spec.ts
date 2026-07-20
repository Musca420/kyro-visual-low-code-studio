import { expect, test } from "@playwright/test";

const rgb = (value: string) => value.match(/\d+/g)!.slice(0, 3).map(Number);
const luminance = (value: string) => {
  const channels = rgb(value).map((item) => {
    const normalized = item / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test("design system chiaro/scuro è persistente, leggibile e adattabile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkToggle = page.getByRole("button", { name: "Use light theme" });
  await expect(darkToggle).toBeVisible();
  const primary = page.getByRole("button", { name: /Blank project/ });
  const colors = await primary.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(contrast(colors.color, colors.background)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: "artifacts/frontend-editor-dashboard-dark.png", fullPage: true });

  await darkToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "artifacts/frontend-editor-dashboard-light.png", fullPage: true });

  await page.getByLabel("Project name").fill(`Design system ${Date.now()}`);
  await page.getByRole("button", { name: "Landing page Hero, features, CTA, and footer" }).click();
  await expect(page.getByRole("separator", { name: "Resize elements panel" })).toHaveAttribute("aria-valuenow", "240");
  await expect(page.getByRole("separator", { name: "Resize properties panel" })).toHaveAttribute("aria-valuenow", "300");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page.screenshot({ path: "artifacts/frontend-editor-workspace-dark.png", fullPage: true });
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.getByRole("button", { name: "Design" })).toBeVisible();
  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".right-panel")).toBeHidden();
  await page.screenshot({ path: "artifacts/frontend-editor-workspace-mobile.png", fullPage: true });
});
