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

test("importa React come componenti visuali senza eseguire il codice", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[webkitdirectory]").setInputFiles(join(process.cwd(), "e2e", "fixtures", "react-import"));
  await expect(page.locator(".import-source-banner")).toContainText("React");
  await expect(page.locator(".import-source-banner")).toContainText("converted statically");
  await expect(page.getByTestId("component-title")).toContainText("Portfolio React");
  await page.getByTestId("component-button").click();
  await page.getByLabel("Text or label").fill("Open imported project");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Preview isolata"]').getByRole("button", { name: "Open imported project" })).toBeVisible();
  await page.screenshot({ path: "artifacts/frontend-editor-react-import.png", fullPage: true });
});

test("importa la sorgente dell'app Android e continua visualmente", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const source = await latestAndroidSource();
  expect(source, "Eseguire prima il test Android completo").toBeTruthy();
  await page.goto("/");
  const directoryInput = page.locator("input[webkitdirectory]");
  await directoryInput.setInputFiles(source!);

  await expect(page.getByLabel("Project name")).toHaveValue(/imported$/);
  await expect(page.locator(".import-source-banner")).toContainText(
    "Capacitor",
  );
  await expect(page.locator(".import-source-banner")).toContainText(
    "complete Kyro model was restored",
  );
  await expect(page.getByText("Titolo", { exact: true }).first()).toBeVisible();

  await page.getByTestId("component-title").click();
  const inspector = page.locator(".right-panel");
  await inspector.getByRole("button", { name: "Advanced" }).click();
  await inspector.getByText("Effects and animations").click();
  await inspector
    .getByLabel("Animation preset")
    .selectOption({ label: "Rise" });
  await inspector.getByText("Background, borders, and corners").click();
  await inspector.getByLabel("Background value", { exact: true }).fill("#fff1cc");
  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(preview.getByRole("heading", { name: "Titolo" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/imported-android-app.png",
    fullPage: true,
  });

  await expect(page.getByText("Saved automatically")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const saved = join(process.cwd(), "artifacts", "imported-android-app.zip");
  await (await download).saveAs(saved);
  const zip = await JSZip.loadAsync(await readFile(saved));
  expect(zip.file("original-project/capacitor.config.ts")).toBeTruthy();
  expect(zip.file("project.frontend-editor.json")).toBeTruthy();

  await page
    .getByRole("button", { name: "Close project and return to the dashboard" })
    .click();
  await page
    .getByRole("button", { name: /imported/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Preview isolata"]')
      .getByRole("heading", { name: "Titolo" }),
  ).toBeVisible();
});
