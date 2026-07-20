import { expect, test } from "@playwright/test";

test("configura la lettura di un record per ID senza codice", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Get visuale");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"])
    await palette.getByRole("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Add nodes to the flow" });
  await nodePalette.getByLabel("Search actions").fill("Load data");
  await nodePalette.getByRole("button", { name: "Load data", exact: true }).click();
  await page.getByLabel("Connected source").selectOption({ label: "Local tasks" });
  await page.getByLabel("Data load type").selectOption("one");
  await page.getByLabel("Record ID to load").fill("{{value}}");
  await page.getByLabel("Input ID field").fill("projectId");
  await expect(page.locator(".react-flow__node").filter({ hasText: "Load data" }).last()).toContainText("unknown → record");
  await expect(page.getByText(/previous step value/)).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-get-record.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: /Get visuale/ }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("navigation", { name: "Flow steps" }).getByRole("button", { name: "Load data", exact: true }).click();
  await expect(page.getByLabel("Data load type")).toHaveValue("one");
  await expect(page.getByLabel("Input ID field")).toHaveValue("projectId");
});
