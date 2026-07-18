import { expect, test } from "@playwright/test";

test("carica un asset, lo assegna visualmente e lo conserva alla riapertura", async ({
  page,
}) => {
  const name = `Asset visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill(name);
  await page.locator(".template").filter({ hasText: "Progetto vuoto" }).click();
  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByLabel("Scegli asset").setInputFiles({
    name: "visuale-prova.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#6d5dfc"/><circle cx="160" cy="80" r="42" fill="white"/></svg>',
    ),
  });
  await expect(
    page.getByText("1 asset caricato e salvato nel progetto"),
  ).toBeVisible();
  await expect(page.locator(".asset-grid")).toContainText("visuale-prova.svg");

  await page.getByRole("button", { name: "Design" }).click();
  await page.getByPlaceholder("Cerca componenti…").fill("immagine");
  await page.locator(".palette button").filter({ hasText: "image" }).click();
  await page
    .getByLabel("File del progetto")
    .selectOption({ label: "visuale-prova.svg" });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.frameLocator('iframe[title="Preview isolata"]').locator("img"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  await page
    .getByRole("button", { name: "Chiudi progetto e torna alla dashboard" })
    .click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.frameLocator('iframe[title="Preview isolata"]').locator("img"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);
});
