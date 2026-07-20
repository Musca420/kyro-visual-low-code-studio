import { expect, test } from "@playwright/test";

test("un utente protegge un'azione per ruolo dal flow visuale", async ({ page }) => {
  const name = `Accesso visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  for (const type of ["input", "button", "list"]) await palette.locator("button").filter({ hasText: type }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();

  const nodePalette = page.getByRole("complementary", { name: "Add nodes to the flow" });
  await nodePalette.getByLabel("Search actions").fill("Check role");
  await nodePalette.getByRole("button", { name: "Check role", exact: true }).click();
  await page.getByLabel("Allowed roles").fill("admin,editor");
  await page.getByLabel("Simulated preview role").selectOption("viewer");
  await page.getByLabel("Access denied message").fill("Solo il team può aggiungere attività");
  const roleNode = page.locator(".react-flow__node").filter({ hasText: "Check role" });
  const eventNode = page.locator(".react-flow__node").filter({ hasText: "Button click" });
  await page.getByRole("button", { name: "Fit view" }).click();
  await eventNode.click();
  await page.getByLabel("Next step").selectOption({ label: "Check role" });
  await roleNode.click();
  await page.getByLabel("Output to connect").selectOption("success");
  await page.getByLabel("Next step").selectOption({ label: "Read input" });
  await page.getByLabel("Output to connect").selectOption("error");
  await page.getByLabel("Next step").selectOption({ label: "Show error" });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  let preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("New task").fill("Task protetto");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(".log-console")).toContainText("Solo il team può aggiungere attività");
  await expect(preview.getByRole("alert")).toContainText("Solo il team può aggiungere attività");

  await page.getByRole("button", { name: /^Flow/ }).click();
  await roleNode.click();
  await page.getByLabel("Simulated preview role").selectOption("editor");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("New task").fill("Task protetto");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(preview.getByText("Task protetto")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-auth-flow.png", fullPage: true });
});
