import { expect, test } from "@playwright/test";

test("configura accesso, ruoli, offline e aggiornamenti senza salvare segreti", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Project name")
    .fill(`Management app configurato ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Management app" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByLabel("Who can sign in?").selectOption("generated");
  await expect(page.getByRole("alert")).toContainText("Backend required");
  await expect(page.getByText("AUTH_SECRET")).toBeVisible();
  await page.getByLabel("Keep an offline copy whenever possible").check();
  await page.getByLabel("Automatic updates").selectOption("sse");
  await expect(page.getByLabel("Update channel")).toHaveValue(
    "http://127.0.0.1:8787/events",
  );
  await page.getByLabel("View only").uncheck();

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByLabel("Generate the backend too").check();
  await page.getByLabel("Name", { exact: true }).fill("Backend gestionale");
  await page.getByLabel("Collection", { exact: true }).fill("records");
  await page
    .getByRole("button", { name: "Configure generated backend" })
    .click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText(/secret values are never saved/)).toBeVisible();
});
