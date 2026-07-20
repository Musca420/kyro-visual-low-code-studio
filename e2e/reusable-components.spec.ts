import { expect, test } from "@playwright/test";

test("salva e riusa un blocco visuale come gruppo nativo modificabile", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Blocchi Canva");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();

  const palette = page.locator(".palette");
  await palette.getByRole("button").filter({ hasText: "card" }).click();
  await palette.getByRole("button", { name: /title$/ }).click();
  await page.getByTestId("component-card").click();
  await page.getByTestId("component-title").click({ modifiers: ["Control"] });
  await page.getByLabel("Reusable block name").fill("Professional feature");
  await page.getByRole("button", { name: "Save selection" }).click();
  await expect(page.getByText("Professional feature saved to your blocks")).toBeVisible();

  const reusable = page.getByRole("button", { name: /Professional feature 2 elements/ });
  await reusable.click();
  await expect(page.getByTestId("component-reusable")).toBeVisible();
  await expect(page.getByTestId("component-reusable").getByTestId("component-title")).toBeVisible();
  await page.getByTestId("component-reusable").getByTestId("component-title").click();
  await page.getByLabel("Text or label").fill("Copied title");
  await expect(page.getByTestId("component-reusable")).toContainText("Copied title");

  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: /Blocchi Canva/ }).click();
  await expect(page.getByRole("button", { name: /Professional feature 2 elements/ })).toBeVisible();
  await expect(page.getByTestId("component-reusable")).toContainText("Copied title");
  await page.screenshot({ path: "artifacts/frontend-editor-reusable-component.png", fullPage: true });
});
