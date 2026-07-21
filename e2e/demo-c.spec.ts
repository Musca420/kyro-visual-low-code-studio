import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import JSZip from "jszip";

async function createRecord(app: FrameLocator | Page, name: string) {
  await app.getByRole("button", { name: /New project/ }).click();
  const form = app.locator("#project-modal form");
  await form.getByLabel("Project name").fill(name);
  await form.getByLabel("Description").fill("Created entirely through the running application");
  await form.getByLabel("Status").selectOption("In progress");
  await form.getByLabel("Priority").selectOption("High");
  await form.getByLabel("Due date").fill("2026-08-20");
  await form.getByRole("button", { name: "Save project" }).click();
  await expect(app.getByText(name, { exact: true })).toBeVisible();
}

test("Demo C: a new four-page app has visual data, flows, responsive runtime and standalone export", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const name = `Demo C Operations ${Date.now()}`, root = process.cwd();
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.locator(".template").filter({ hasText: "Management app" }).click();
  await page.getByRole("button", { name: /Add page/ }).click();
  await page.getByLabel("Screen name").fill("Team");
  await page.getByLabel("Screen route").fill("team");
  await page.getByRole("button", { name: "Create screen" }).click();
  await expect(page.locator(".page-list button:not(.dashed)")).toHaveCount(4);

  await page.getByRole("button", { name: "Data" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Operations projects");
  await page.getByLabel("Collection", { exact: true }).fill("projects");
  await page.getByRole("button", { name: "Create IndexedDB source" }).click();
  await expect(page.getByText("IndexedDB source created and schema validated")).toBeVisible();
  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create dashboard flow" }).click();
  await expect(page.getByText("CRUD, loading, search, filter, sort, and KPI flows connected")).toBeVisible();
  await expect(page.getByLabel("Active flow").locator("option")).toHaveCount(7);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await createRecord(preview, "Runtime launch plan");
  await expect(preview.locator('[data-kpi="total"]')).toHaveText("1");
  await page.getByRole("button", { name: "mobile" }).click();
  await expect(page.locator('iframe[title="Preview isolata"]')).toHaveClass(/preview-mobile/);
  await preview.getByRole("button", { name: "Open navigation" }).click();
  const mobileNavigation = preview.getByRole("navigation", { name: "Dashboard" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.locator("..")).toHaveCSS("background-color", "rgb(17, 24, 39)");
  const drawer = await mobileNavigation.locator("..").boundingBox();
  expect(drawer?.width).toBeGreaterThanOrEqual(230);
  expect(drawer?.width).toBeLessThanOrEqual(250);
  await page.locator('iframe[title="Preview isolata"]').screenshot({ path: "artifacts/demo-c-mobile-runtime.png" });

  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.locator(".page-list button:not(.dashed)")).toHaveCount(4);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview.getByText("Runtime launch plan", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export app" }).click();
  const archive = join(root, "artifacts", "demo-c-four-page-app.zip");
  await (await download).saveAs(archive);
  const zip = await JSZip.loadAsync(await readFile(archive));
  const runtime = JSON.parse(await zip.file("runtime-program.json")!.async("string"));
  expect(runtime.pages).toHaveLength(4);
  expect(runtime.flows).toHaveLength(7);
  expect(runtime.dataSources).toHaveLength(1);
  const exportRoot = join(root, "test-results", `demo-c-export-${Date.now()}`);
  for (const [relative, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = normalize(join(exportRoot, relative));
    expect(target.startsWith(`${normalize(exportRoot)}${sep}`)).toBe(true);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"));
  }

  const vite = join(root, "node_modules", "vite", "bin", "vite.js"), port = 4198;
  const server = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(port)], { cwd: exportRoot, stdio: "ignore" });
  try {
    await expect.poll(async () => fetch(`http://127.0.0.1:${port}`).then((value) => value.status).catch(() => 0), { timeout: 15_000 }).toBe(200);
    const standalone = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await standalone.goto(`http://127.0.0.1:${port}`);
    await expect(standalone.locator("[data-route]")).toHaveCount(4);
    await createRecord(standalone, "Standalone verified project");
    await standalone.screenshot({ path: "artifacts/demo-c-standalone-runtime.png", fullPage: true });
    await standalone.close();
  } finally {
    server.kill();
  }
});
