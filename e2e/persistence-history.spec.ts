import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("versioni ed export persistono, si ripristinano e rientrano nel backup", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("Persistent Creative Work");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "Title" }).click();
  const text = page.getByLabel("Text or label");
  await text.fill("Prima versione visuale");
  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });
  await text.fill("Seconda versione visuale");
  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });

  const versions = page.locator(".history-menu").filter({ hasText: /^Versions/ });
  await expect(versions.locator("summary")).toContainText(/Versions [2-9]/);
  await versions.locator("summary").click();
  await versions.getByRole("button").nth(1).click();
  await expect(page.getByTestId("component-title").getByRole("heading")).toHaveText("Prima versione visuale");

  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  await exportDownload;
  await expect(page.getByText("TypeScript app exported as a ZIP and archived")).toBeVisible();
  await expect(page.locator(".history-menu").filter({ hasText: /^Exports/ }).locator("summary")).toHaveText("Exports 1");
  await page.screenshot({ path: "artifacts/frontend-editor-persistent-history.png", fullPage: true });

  await page.reload();
  await page.getByRole("button", { name: /Persistent Creative Work/ }).click();
  await expect(page.locator(".history-menu").filter({ hasText: /^Exports/ }).locator("summary")).toHaveText("Exports 1");
  const storedExports = page.locator(".history-menu").filter({ hasText: /^Exports/ });
  await storedExports.locator("summary").click();
  const storedDownload = page.waitForEvent("download");
  await storedExports.getByRole("button", { name: /persistent-creative-work\.zip/i }).click();
  expect((await storedDownload).suggestedFilename()).toBe("persistent-creative-work.zip");

  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create backup" }).click();
  const backupPath = await (await backupDownload).path();
  const backup = JSON.parse(await readFile(backupPath!, "utf8"));
  expect(backup.versions.some((version: { projectId: string }) => version.projectId === backup.projects.find((project: { name: string }) => project.name === "Persistent Creative Work").id)).toBe(true);
  expect(backup.exports.some((record: { fileName: string }) => record.fileName === "persistent-creative-work.zip")).toBe(true);
});
