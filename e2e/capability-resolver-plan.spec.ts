import { expect, test } from "@playwright/test";

test("spiega un servizio esterno e lascia la scelta all'utente", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Resolver guidato");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "button" }).click();
  await page.getByTestId("component-button").click();
  await page.getByText("Meaning in the program").click();
  await page.getByLabel("Expected result", { exact: true }).fill("completa pagamento checkout");

  const issue = page.locator(".capability-issues article").filter({ hasText: "Payment provider required" });
  await expect(issue).toBeVisible();
  await issue.getByText("Compare solutions").click();
  await expect(issue).toContainText("Public key in the client and secret only in the backend");
  await expect(issue).toContainText("Hosted payment link: simplest path");
  await expect(issue).toContainText("commissions");
  await expect(issue).toContainText("without your confirmation");
  await page.mouse.move(600, 700);
  await page.screenshot({ path: "artifacts/frontend-editor-capability-plan.png", fullPage: true });
});
