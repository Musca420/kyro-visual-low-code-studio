import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const luminance = (color: string) => {
  const values = color.match(/\d+/g)!.slice(0, 3).map(Number).map((item) => {
    const value = item / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
};

test("backup e ripristino conservano progetto, dati e ricerca della home", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Nome progetto").fill("Backup Roundtrip");
  await page.getByRole("button", { name: "Progetto vuoto Parti da una tela pulita" }).click();
  await page.getByRole("button", { name: "Aggiungi pagina", exact: true }).click();
  const palette = page.locator(".palette");
  const canvas = page.locator(".design-canvas");
  await palette.getByRole("button", { name: /input/ }).dragTo(canvas);
  await palette.getByRole("button", { name: /button/ }).dragTo(canvas);
  await palette.getByRole("button", { name: /list/ }).dragTo(canvas);
  await page.getByRole("button", { name: "Dati" }).click();
  await page.getByRole("button", { name: "Crea sorgente IndexedDB" }).click();
  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Crea flow dati" }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("Nuova attività").fill("Dato conservato nel backup");
  await preview.getByRole("button", { name: "Aggiungi" }).click();
  await expect(preview.getByText("Dato conservato nel backup")).toBeVisible();
  await expect(page.getByText("Salvato automaticamente")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Chiudi progetto e torna alla dashboard" }).click();

  await page.getByPlaceholder("Cerca progetti…").fill("nessun risultato");
  await expect(page.getByRole("button", { name: /Backup Roundtrip/ })).toHaveCount(0);
  await expect(page.getByText("Nessun progetto trovato")).toBeVisible();
  await page.getByPlaceholder("Cerca progetti…").fill("backup");
  await expect(page.getByRole("button", { name: /Backup Roundtrip/ })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Crea backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();
  const backup = JSON.parse(await readFile(backupPath!, "utf8"));
  expect(backup).toMatchObject({
    format: "frontend-editor-backup",
    version: 1,
    preferences: { "frontend-editor-theme": "dark" },
  });
  expect(backup.projects).toHaveLength(1);
  expect(backup.records).toEqual(expect.arrayContaining([expect.objectContaining({ text: "Dato conservato nel backup" })]));

  page.once("dialog", (dialog) => dialog.accept());
  const card = page.locator(".project-card").filter({ hasText: "Backup Roundtrip" });
  await card.getByRole("button", { name: "Elimina" }).click();
  await expect(card).toHaveCount(0);

  await page.locator('.recent input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText(/Ripristino completato: 1 progetti, 1 record/)).toBeVisible();
  await page.getByPlaceholder("Cerca progetti…").fill("");
  const cardColors = await page.locator(".project-open").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor];
  });
  const levels = cardColors.map(luminance).sort((a, b) => b - a);
  expect((levels[0] + 0.05) / (levels[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: "artifacts/frontend-editor-home-backup.png", fullPage: true });
  await page.getByRole("button", { name: /Backup Roundtrip/ }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByText("Dato conservato nel backup")).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-backup-restored.png", fullPage: true });
});
