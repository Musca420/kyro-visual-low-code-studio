import { expect, test } from "@playwright/test";

test("utente grafica crea uno stile professionale senza proprietà tecniche", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const name = `Canva user ${Date.now()}`;
  await page.getByLabel("Nome progetto").fill(name);
  await page.getByRole("button", { name: "Landing page Hero, feature, CTA e footer" }).click();
  await page.getByRole("button", { name: /Hero title/ }).click();

  const inspector = page.locator(".right-panel");
  await expect(inspector.getByRole("button", { name: "Essenziale" })).toHaveClass(/active/);
  await expect(inspector.getByText("Dimensioni e responsive")).toBeHidden();
  await inspector.getByRole("button", { name: "Palette Corallo" }).click();
  await inspector.getByLabel("Gradiente pronto").selectOption({ label: "Tramonto" });
  await inspector.getByLabel("Font rapido").selectOption({ label: "Editoriale" });
  await inspector.getByLabel("Peso rapido").selectOption({ label: "Forte" });
  await inspector.getByRole("button", { name: "Allinea al centro" }).click();
  await inspector.getByLabel("Angoli rapido").fill("28");
  await inspector.getByLabel("Spazio interno rapido").fill("36");
  await inspector.getByLabel("Ombra rapida").selectOption({ label: "Media" });
  await inspector.getByLabel("Animazione rapida").selectOption({ label: "Salita" });

  const title = page.getByTestId("component-title").first();
  await expect(title).toHaveCSS("font-family", /Georgia/);
  await expect(title).toHaveCSS("text-align", "center");
  await expect(title).toHaveCSS("border-radius", "28px");
  await expect(title).toHaveCSS("padding-top", "36px");
  await page.locator(".page-list button").filter({ hasText: "Landing" }).click();
  await expect(page.getByRole("region", { name: "Aspetto pagina" })).toBeVisible();
  await page.getByRole("button", { name: "Sfondo pagina Menta" }).click();
  await page.getByLabel("Gradiente pagina").selectOption({ label: "Aurora" });
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

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: /Hero title/ }).click();
  await expect(page.locator(".right-panel").getByLabel("Gradiente pronto")).toHaveValue(/linear-gradient/);
  expect(errors).toEqual([]);
});
