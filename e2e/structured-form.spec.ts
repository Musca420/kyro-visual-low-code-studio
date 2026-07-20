import { expect, test } from "@playwright/test";

test("un form visuale salva un record multi-campo reale", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const projectName = `Form strutturato ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  await palette.locator("button").filter({ hasText: "form" }).click();

  const addField = async (label: string, fieldName: string, type: "text" | "number") => {
    await palette.locator("button").filter({ hasText: "input" }).click();
    await page.getByLabel("Text or label").fill(label);
    await page.getByLabel("Data field name").fill(fieldName);
    await page.getByLabel("Field type").selectOption(type);
    await page.getByLabel("Inside").selectOption({ label: "Form" });
  };
  await addField("Name prodotto", "name", "text");
  await addField("Prezzo", "price", "number");
  await palette.locator("button").filter({ hasText: "button" }).click();
  await page.getByLabel("Text or label").fill("Save product");
  await page.getByLabel("Button behavior").selectOption("submit");
  await page.getByLabel("Inside").selectOption({ label: "Form" });
  await palette.locator("button").filter({ hasText: "list" }).click();

  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Prodotti locali");
  await page.getByLabel("Collection", { exact: true }).fill("products");
  await page.getByLabel("Field name").nth(1).fill("name");
  await page.getByRole("button", { name: "+ Add field" }).click();
  await page.getByLabel("Field name").last().fill("price");
  await page.getByLabel("Field type price").selectOption("number");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();

  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  const flowNodes = page.getByRole("navigation", { name: "Flow steps" });
  await flowNodes.getByRole("button", { name: "Button click", exact: true }).click();
  await page.getByLabel("Event type").selectOption("submit");
  await page.getByLabel("Connected element").selectOption({ label: "Form · form" });
  await flowNodes.getByRole("button", { name: "Read input", exact: true }).click();
  await page.getByRole("button", { name: "Delete step" }).click();
  await flowNodes.getByRole("button", { name: "Not empty", exact: true }).click();
  await page.getByLabel("Validation field").fill("name");
  await page.getByLabel("Validation rule").selectOption("required");
  await page.getByLabel("Validation message").fill("Enter the product name");
  await flowNodes.getByRole("button", { name: "Button click", exact: true }).click();
  await page.getByLabel("Next step").selectOption({ label: "Not empty" });

  await page.getByRole("button", { name: "Design", exact: true }).click();
  await page.getByRole("tree").getByRole("button", { name: /Form/ }).first().click();
  await expect(page.locator(".program-connections")).toContainText("1 events");

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  expect(await preview.locator("script").evaluate((script) => script.textContent)).toContain('"event":"submit"');
  await preview.getByLabel("Prezzo").fill("39");
  await expect(preview.getByRole("button", { name: "Save product" })).toHaveAttribute("type", "submit");
  await preview.getByRole("button", { name: "Save product" }).click();
  await expect(preview.getByRole("alert")).toContainText("Enter the product name");
  await preview.getByLabel("Name prodotto").fill("Lampada Aurora");
  await preview.getByRole("button", { name: "Save product" }).click();
  expect(runtimeErrors).toEqual([]);
  await expect(page.locator(".log-console")).toContainText("Create record: completed");
  await expect(preview.getByText("Lampada Aurora")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-structured-form.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByText("Lampada Aurora")).toBeVisible();
});
