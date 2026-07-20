import { expect, test } from "@playwright/test";

test("propone storage locale, API esistente o backend generato in linguaggio semplice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill(`Backend guidato ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Task list" }).click();
  await page.getByRole("button", { name: "Data" }).click();

  await expect(page.getByText("On this device")).toBeVisible();
  await expect(page.getByText("Existing service")).toBeVisible();
  await page.getByLabel("Generate the backend too").check();
  await expect(
    page.getByRole("textbox", { name: /API address/ }),
  ).toHaveValue("http://127.0.0.1:8787/records");
  await page.getByLabel("Name", { exact: true }).fill("Backend attività");
  await page.getByLabel("Collection", { exact: true }).fill("records");
  await page
    .getByRole("button", { name: "Configure generated backend" })
    .click();
  await expect(
    page.getByText("Local backend configured: it will be included in the export"),
  ).toBeVisible();
  await expect(page.locator(".source-card")).toContainText(
    "generated / records",
  );
});

test("crea uno schema dati personalizzato interamente dall'interfaccia", async ({ page }) => {
  const name = `Schema visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "+ Add field" }).click();
  const fields = page.getByLabel("Field name");
  await fields.last().fill("budget");
  await page.getByLabel("Field type budget").selectOption("number");
  await page.getByRole("button", { name: "+ Add field" }).click();
  await fields.last().fill("pubblicato");
  await page.getByLabel("Field type pubblicato").selectOption("boolean");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  const source = page.locator(".source-card");
  await expect(source).toContainText("budget:number");
  await expect(source).toContainText("pubblicato:boolean");
  await page.screenshot({ path: "artifacts/frontend-editor-visual-schema.png", fullPage: true });
  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.locator(".source-card")).toContainText("budget:number");
  await expect(page.locator(".source-card")).toContainText("pubblicato:boolean");
});
