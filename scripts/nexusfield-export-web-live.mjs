import { chromium } from "playwright";
import { resolve } from "node:path";
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 180, viewport: { width: 1600, height: 900 }, acceptDownloads: true, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (await page.getByRole("button", { name: "Close project and return to the dashboard" }).count())
    await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: /NexusField Web/ }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: /^PWA/ }).click();
  await page.getByText("Installable PWA ready", { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Export app" }).click();
  const download = await downloadPromise; const target = resolve("artifacts", "nexusfield", "NexusField-Web-export.zip"); await download.saveAs(target);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "41-web-pwa-export.png"), fullPage: true });
  console.log(JSON.stringify({ suggestedFilename: download.suggestedFilename(), target }, null, 2)); await page.waitForTimeout(4000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-export.png"), fullPage: true }); throw error; } finally { await context.close(); }
