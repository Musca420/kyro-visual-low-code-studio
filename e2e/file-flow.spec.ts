import { expect, test } from "@playwright/test";

test("un utente salva un file locale con un flow costruito visualmente", async ({ page }) => {
  const projectName = `Archivio visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list", "upload"])
    await palette.locator("button").filter({ hasText: type }).click();

  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("File locali");
  await page.getByLabel("Collection", { exact: true }).fill("assets");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();

  const flowNodes = page.getByRole("navigation", { name: "Flow steps" });
  await flowNodes.getByRole("button", { name: "Button click", exact: true }).click();
  await page.getByLabel("Event type").selectOption("change");
  await page.getByLabel("Connected element").selectOption({ label: "Upload · upload" });
  for (const label of ["Read input", "Not empty"]) {
    await flowNodes.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: "Delete step" })).toBeVisible();
    await page.getByRole("button", { name: "Delete step" }).click();
  }

  const nodePalette = page.getByRole("complementary", { name: "Add nodes to the flow" });
  await nodePalette.getByLabel("Search actions").fill("Prepare file");
  await nodePalette.getByRole("button", { name: "Prepare file", exact: true }).click();
  await page.getByLabel("Maximum file size").fill("1");
  await page.getByLabel("Accepted file types").fill("image/*");
  await flowNodes.getByRole("button", { name: "Button click", exact: true }).click();
  await page.getByLabel("Next step").selectOption({ label: "Prepare file" });
  await flowNodes.getByRole("button", { name: "Prepare file", exact: true }).click();
  await page.getByLabel("Next step").selectOption({ label: "Create record" });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("upload").setInputFiles({ name: "aurora.png", mimeType: "image/png", buffer: Buffer.from("pixel") });
  await expect(page.locator(".log-console")).toContainText("Prepare file: completed");
  await expect(preview.getByText("aurora.png")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-file-storage.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByText("aurora.png")).toBeVisible();
});
