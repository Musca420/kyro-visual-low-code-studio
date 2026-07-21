import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:43131";
const output = process.argv[3] ?? ".kyro/installed-release-verification";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: false, slowMo: 550 });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Project name").fill("Kyro 2.1 Install Smoke");
  await page.getByLabel("Project goal").fill("Verify the published CLI through the same visual path used by a new user.");
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByLabel("Screen name").fill("Home");
  await page.getByLabel("Screen route").fill("/");
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: /title$/i }).first().click();
  await page.getByLabel("Text or label").fill("Installed release works visually.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Preview isolata"]');
  await frame.getByRole("heading", { name: "Installed release works visually." }).waitFor();
  await page.screenshot({ path: `${output}/preview.png`, fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Kyro 2.1 Install Smoke" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.frameLocator('iframe[title="Preview isolata"]').getByRole("heading", { name: "Installed release works visually." }).waitFor();
  if (errors.length) throw new Error(`Installed release browser errors: ${errors.join(" | ")}`);
  const result = { version: "2.1.0", visualEdit: true, preview: true, persistedAfterReload: true, errors };
  await writeFile(`${output}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
  await browser.close();
}
