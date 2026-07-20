import { expect, test } from "@playwright/test";

test("un utente evolve lo schema e collega due entità senza codice", async ({ page }) => {
  const projectName = `Data collegati ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();

  await page.getByLabel("Name", { exact: true }).fill("Clienti");
  await page.getByLabel("Collection", { exact: true }).fill("clients");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await expect(page.getByRole("region", { name: "Data source evolution" })).toContainText("Schema v1");

  await page.getByLabel("Name", { exact: true }).fill("Projects");
  await page.getByLabel("Collection", { exact: true }).fill("projects");
  await page.getByRole("button", { name: "+ Add field" }).click();
  await page.getByLabel("Field name", { exact: true }).last().fill("clientId");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  const evolution = page.getByRole("region", { name: "Data source evolution" });
  await evolution.getByLabel("Local relation field").selectOption("clientId");
  await evolution.getByLabel("Relation source").selectOption({ label: "Clienti" });
  await evolution.getByLabel("Relation target field").selectOption("id");
  await evolution.getByRole("button", { name: "Create relation" }).click();
  await expect(evolution).toContainText("clientId → Clienti.id · one");

  await evolution.getByRole("button", { name: "+ New field" }).click();
  await evolution.getByLabel("Existing schema field name").last().fill("budget");
  await evolution.getByLabel("Existing field type budget").selectOption("number");
  await evolution.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Schema updated to version 2. Existing records remain available.")).toBeVisible();
  await expect(evolution).toContainText("Schema v2");
  await evolution.getByText("Schema history").click();
  await expect(evolution).toContainText("Version 2");
  await page.screenshot({ path: "artifacts/frontend-editor-data-relations.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: /Projects/ }).click();
  await expect(page.getByRole("region", { name: "Data source evolution" })).toContainText("Schema v2");
  await expect(page.getByRole("region", { name: "Data source evolution" })).toContainText("clientId → Clienti.id · one");
});
