import { expect, test } from "@playwright/test";

test("misura i nodi e conserva la cronologia flow alla riapertura", async ({ page }) => {
  const projectName = `Profiling visuale ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Project name").fill(projectName);
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
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("New task").fill("Misura questo flow");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(".log-step").first().locator("time")).toContainText("ms");
  await page.locator(".flow-run-history summary").click();
  await expect(page.locator(".flow-run-history")).toContainText("5 steps");
  await page.screenshot({ path: "artifacts/frontend-editor-flow-profile.png", fullPage: true });

  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: projectName }).click();
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.locator(".flow-run-history summary").click();
  await expect(page.locator(".flow-run-history")).toContainText("5 steps");
  await page.locator(".flow-run-history button").first().click();
  await expect(page.locator(".log-console")).toContainText("Button click: completed");
});
