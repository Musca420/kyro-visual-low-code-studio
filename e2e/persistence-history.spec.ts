import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("versioni ed export persistono, si ripristinano e rientrano nel backup", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Persistent Creative Work");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  await page.locator(".palette").getByRole("button").filter({ hasText: "Title" }).click();
  const text = page.getByLabel("Testo o etichetta");
  await text.fill("Prima versione visuale");
  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await text.fill("Seconda versione visuale");
  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });

  const versions = page.locator(".history-menu").filter({ hasText: /^Versioni/ });
  await expect(versions.locator("summary")).toContainText(/Versioni [2-9]/);
  await versions.locator("summary").click();
  await versions.getByRole("button").nth(1).click();
  await expect(page.getByTestId("component-title").getByRole("heading")).toHaveText("Prima versione visuale");

  const exportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta app" }).click();
  await exportDownload;
  await expect(page.getByText("App TypeScript esportata come ZIP e archiviata")).toBeVisible();
  await expect(page.locator(".history-menu").filter({ hasText: /^Export/ }).locator("summary")).toHaveText("Export 1");
  await page.screenshot({ path: "artifacts/frontend-editor-persistent-history.png", fullPage: true });

  await page.reload();
  await page.getByRole("button", { name: /Persistent Creative Work/ }).click();
  await expect(page.locator(".history-menu").filter({ hasText: /^Export/ }).locator("summary")).toHaveText("Export 1");
  const storedExports = page.locator(".history-menu").filter({ hasText: /^Export/ });
  await storedExports.locator("summary").click();
  const storedDownload = page.waitForEvent("download");
  await storedExports.getByRole("button", { name: /persistent-creative-work\.zip/i }).click();
  expect((await storedDownload).suggestedFilename()).toBe("persistent-creative-work.zip");

  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();
  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Crea backup" }).click();
  const backupPath = await (await backupDownload).path();
  const backup = JSON.parse(await readFile(backupPath!, "utf8"));
  expect(backup.versions.some((version: { projectId: string }) => version.projectId === backup.projects.find((project: { name: string }) => project.name === "Persistent Creative Work").id)).toBe(true);
  expect(backup.exports.some((record: { fileName: string }) => record.fileName === "persistent-creative-work.zip")).toBe(true);
});
