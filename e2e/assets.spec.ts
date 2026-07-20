import { expect, test } from "@playwright/test";

test("carica un asset, lo assegna visualmente e lo conserva alla riapertura", async ({
  page,
}) => {
  const name = `Asset visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.locator(".template").filter({ hasText: "Blank project" }).click();
  await page.getByRole("button", { name: "Design" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.getByRole("button", { name: "Data" }).click();
  await page.getByLabel("Choose asset").setInputFiles({
    name: "visuale-prova.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#6d5dfc"/><circle cx="160" cy="80" r="42" fill="white"/></svg>',
    ),
  });
  await expect(
    page.getByText("1 asset uploaded and saved in the project"),
  ).toBeVisible();
  await expect(page.locator(".asset-grid")).toContainText("visuale-prova.svg");

  await page.getByRole("button", { name: "Design" }).click();
  await page.getByPlaceholder("Search components…").fill("image");
  await page.locator(".palette button").filter({ hasText: "image" }).click();
  await page
    .getByLabel("Project file")
    .selectOption({ label: "visuale-prova.svg" });
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.frameLocator('iframe[title="Preview isolata"]').locator("img"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page
    .getByRole("button", { name: "Close project and return to the dashboard" })
    .click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.frameLocator('iframe[title="Preview isolata"]').locator("img"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);
});
