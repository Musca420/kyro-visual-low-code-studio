import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import JSZip from "jszip";

test("Demo B: an existing multi-page Web App keeps a global visual change in Preview and standalone export", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const name = `Demo B Web App ${Date.now()}`, root = process.cwd();
  await page.goto("/");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Landing page Hero, features, CTA, and footer" }).click();
  await expect(page.getByRole("button", { name: /Pricing/ })).toBeVisible();
  await page.getByRole("button", { name: "Flow" }).click();
  await page.getByRole("button", { name: "Create landing interactions" }).click();
  await expect(page.getByText(/flows connected/i)).toBeVisible();
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name) }).click();

  await page.getByLabel("Page color value").fill("#e6fbf8");
  await expect(page.getByText("Saved automatically")).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview isolata"]');
  await expect(preview.locator("body")).toHaveCSS("background-color", "rgb(230, 251, 248)");
  await expect(preview.getByRole("heading", { name: "Build clearer products, faster." })).toBeVisible();
  await preview.getByRole("link", { name: "Pricing" }).click();
  await expect(preview.getByRole("heading", { name: "A simple plan for every ambition." })).toBeVisible();
  await expect(preview.locator("body")).toHaveCSS("background-color", "rgb(230, 251, 248)");

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "Export app" }).click({ force: true });
  await page.waitForTimeout(1_000);
  const failure = page.locator(".global-feedback");
  if (await failure.isVisible() && !/exported as a ZIP/i.test(await failure.innerText())) throw new Error(await failure.innerText());
  const download = await downloadPromise;
  const archive = join(root, "artifacts", "demo-b-global-web-app.zip");
  await download.saveAs(archive);
  const zip = await JSZip.loadAsync(await readFile(archive));
  expect(await zip.file("src/style.css")!.async("string")).toContain("body{background:#e6fbf8");
  const exportRoot = join(root, "test-results", `demo-b-export-${Date.now()}`);
  for (const [relative, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const target = normalize(join(exportRoot, relative));
    expect(target.startsWith(`${normalize(exportRoot)}${sep}`)).toBe(true);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"));
  }

  const vite = join(root, "node_modules", "vite", "bin", "vite.js"), port = 4197;
  const server = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(port)], { cwd: exportRoot, stdio: "ignore" });
  try {
    await expect.poll(async () => fetch(`http://127.0.0.1:${port}`).then((value) => value.status).catch(() => 0), { timeout: 15_000 }).toBe(200);
    const standalone = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await standalone.goto(`http://127.0.0.1:${port}`);
    await expect(standalone.locator("body")).toHaveCSS("background-color", "rgb(230, 251, 248)");
    await standalone.getByRole("link", { name: "Pricing" }).click();
    await expect(standalone.getByRole("heading", { name: "A simple plan for every ambition." })).toBeVisible();
    await expect(standalone.locator("body")).toHaveCSS("background-color", "rgb(230, 251, 248)");
    await standalone.screenshot({ path: "artifacts/demo-b-global-standalone.png", fullPage: true });
    await standalone.close();
  } finally {
    server.kill();
  }
});
