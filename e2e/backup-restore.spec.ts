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
  await page.getByLabel("Project name").fill("Backup Roundtrip");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  const palette = page.locator(".palette");
  const canvas = page.locator(".design-canvas");
  await palette.getByRole("button", { name: /input/ }).dragTo(canvas);
  await palette.getByRole("button", { name: /button/ }).dragTo(canvas);
  await palette.getByRole("button", { name: /list/ }).dragTo(canvas);
  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create data flow" }).click();
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await preview.getByLabel("New task").fill("Dato conservato nel backup");
  await preview.getByRole("button", { name: "Add" }).click();
  await expect(preview.getByText("Dato conservato nel backup")).toBeVisible();
  await expect(page.getByText("Saved automatically")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();

  await page.getByPlaceholder("Search projects…").fill("nessun risultato");
  await expect(page.getByRole("button", { name: /Backup Roundtrip/ })).toHaveCount(0);
  await expect(page.getByText("No projects found")).toBeVisible();
  await page.getByPlaceholder("Search projects…").fill("backup");
  await expect(page.getByRole("button", { name: /Backup Roundtrip/ })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Create backup" }).click();
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
  expect(backup.artifacts.length).toBeGreaterThan(0);
  expect(backup.artifacts.every((artifact: { kind: string; sha256: string }) => artifact.kind === "report" && /^[a-f0-9]{64}$/.test(artifact.sha256))).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  const card = page.locator(".project-card").filter({ hasText: "Backup Roundtrip" });
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(card).toHaveCount(0);

  await page.locator('.recent input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText(/Restore completed: 1 projects, 1 records/)).toBeVisible();
  await page.getByPlaceholder("Search projects…").fill("");
  const restoredArtifacts = await page.evaluate(async () => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open("frontend-editor", 8);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction("artifacts").objectStore("artifacts").count();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }));
  expect(restoredArtifacts).toBe(backup.artifacts.length);
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
