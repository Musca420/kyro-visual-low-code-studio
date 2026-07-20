import { expect, test } from "@playwright/test";

test("utente grafica crea uno stile professionale senza proprietà tecniche", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const name = `Canva user ${Date.now()}`;
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Landing page Hero, features, CTA, and footer" }).click();
  await page.getByRole("button", { name: /Hero title/ }).click();

  const inspector = page.locator(".right-panel");
  await expect(inspector.getByRole("button", { name: "Essential" })).toHaveClass(/active/);
  await expect(inspector.getByText("Size and responsive")).toBeHidden();
  await inspector.getByRole("button", { name: "Palette Coral" }).click();
  await inspector.getByLabel("Ready gradient").selectOption({ label: "Sunset" });
  await inspector.getByLabel("Quick font").selectOption({ label: "Editorial" });
  await inspector.getByLabel("Quick weight").selectOption({ label: "Heavy" });
  await inspector.getByRole("button", { name: "Align center" }).click();
  await inspector.getByLabel("Quick corners").fill("28");
  await inspector.getByLabel("Quick inner spacing").fill("36");
  await inspector.getByLabel("Quick shadow").selectOption({ label: "Medium" });
  await inspector.getByLabel("Quick animation").selectOption({ label: "Rise" });

  const title = page.getByTestId("component-title").first();
  await expect(title).toHaveCSS("font-family", /Georgia/);
  await expect(title).toHaveCSS("text-align", "center");
  await expect(title).toHaveCSS("border-radius", "28px");
  await expect(title).toHaveCSS("padding-top", "36px");
  await page.locator(".page-list button").filter({ hasText: "Landing" }).click();
  await expect(page.getByRole("region", { name: "Page appearance" })).toBeVisible();
  await page.getByRole("button", { name: "Mint page background" }).click();
  await page.getByLabel("Page gradient").selectOption({ label: "Aurora" });
  await expect(page.locator(".design-canvas")).toHaveCSS("background-image", /linear-gradient/);
  await page.locator(".canvas-toolbar").hover();
  await page.screenshot({ path: "artifacts/canva-user-quick-style.png", fullPage: true });

  await page.getByRole("button", { name: "Preview" }).click();
  const previewTitle = page.frameLocator('.preview-frame').getByRole("heading", { name: "Build clearer products, faster." });
  await expect(previewTitle).toHaveCSS("text-align", "center");
  await expect(previewTitle).toHaveCSS("border-radius", "28px");
  await expect(previewTitle).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.frameLocator('.preview-frame').locator("body")).toHaveCSS("background-image", /linear-gradient/);
  await page.getByRole("button", { name: "mobile" }).click();
  await expect(previewTitle).toBeVisible();
  await page.screenshot({ path: "artifacts/canva-user-mobile-preview.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: /Hero title/ }).click();
  await expect(page.locator(".right-panel").getByLabel("Ready gradient")).toHaveValue(/linear-gradient/);
  expect(errors).toEqual([]);
});
