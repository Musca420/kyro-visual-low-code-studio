import { expect, test } from "@playwright/test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";

async function latestAndroidSource() {
  const root = join(process.cwd(), "android-builds");
  const entries = await readdir(root, { withFileTypes: true });
  const directories = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => ({
        path: join(root, entry.name),
        modified: (await stat(join(root, entry.name))).mtimeMs,
      })),
  );
  return directories.sort((a, b) => b.modified - a.modified)[0]?.path;
}

test("importa la sorgente dell'app Android e continua visualmente", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const source = await latestAndroidSource();
  expect(source, "Eseguire prima il test Android completo").toBeTruthy();
  await page.goto("/");
  const directoryInput = page.locator("input[webkitdirectory]");
  await directoryInput.setInputFiles(source!);

  await expect(page.getByLabel("Nome progetto")).toHaveValue(/importato$/);
  await expect(page.locator(".import-source-banner")).toContainText(
    "Capacitor",
  );
  await expect(page.locator(".import-source-banner")).toContainText(
    "modello Frontend Editor è stato ripristinato integralmente",
  );
  await expect(page.getByText("Titolo", { exact: true }).first()).toBeVisible();

  await page.getByTestId("component-title").click();
  const inspector = page.locator(".right-panel");
  await inspector.getByText("Effetti e animazioni").click();
  await inspector
    .getByLabel("Animazione pronta")
    .selectOption({ label: "Salita" });
  await inspector.getByText("Sfondo, bordi e angoli").click();
  await inspector.getByLabel("Sfondo valore").fill("#fff1cc");
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(preview.getByRole("heading", { name: "Titolo" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/imported-android-app.png",
    fullPage: true,
  });

  await expect(page.getByText("Salvato automaticamente")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta app" }).click();
  const saved = join(process.cwd(), "artifacts", "imported-android-app.zip");
  await (await download).saveAs(saved);
  const zip = await JSZip.loadAsync(await readFile(saved));
  expect(zip.file("original-project/capacitor.config.ts")).toBeTruthy();
  expect(zip.file("project.frontend-editor.json")).toBeTruthy();

  await page
    .getByRole("button", { name: "Chiudi progetto e torna alla dashboard" })
    .click();
  await page
    .getByRole("button", { name: /importato/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Preview isolata"]')
      .getByRole("heading", { name: "Titolo" }),
  ).toBeVisible();
});
