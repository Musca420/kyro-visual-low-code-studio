import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 240,
  viewport: { width: 1600, height: 900 },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count()))
    await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: /^Android/ }).click();
  await page.getByRole("button", { name: "Check tools" }).click();
  await page.getByText(/Android SDK/).last().waitFor();
  await page.getByLabel(/Required permissions/).selectOption(["camera", "geolocation", "notifications"]);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "07-android-tools-ready.png"), fullPage: true });
  await page.getByRole("button", { name: "Prepare Android project" }).click();
  const status = page.getByRole("status");
  await status.filter({ hasText: /Android project ready|did not|failed|error/i }).waitFor({ timeout: 600_000 });
  const result = await status.innerText();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "08-android-build-result.png"), fullPage: true });
  console.log(result);
  if (!result.includes("Android project ready")) throw new Error(result);
  await page.waitForTimeout(4000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-android-build.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
