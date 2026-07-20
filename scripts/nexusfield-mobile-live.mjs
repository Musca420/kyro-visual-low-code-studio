import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve("artifacts", "nexusfield");
await mkdir(artifacts, { recursive: true });
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 240,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve(artifacts, "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.on("dialog", (dialog) => dialog.accept());
page.on("console", (message) => {
  if (message.type() === "error") console.error(`[browser console] ${message.text()}`);
});
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  await page.bringToFront();
  await page.waitForTimeout(1200);

  const recent = page.getByText("NexusField Mobile", { exact: true });
  if (!(await recent.count())) {
    await page.getByRole("radio", { name: /Android app/ }).check();
    await page.getByPlaceholder("My application").fill("NexusField Mobile");
    await page.getByPlaceholder(/organize tasks/).fill(
      "A local-first field-service marketplace for customers, professionals, employees, managers, and administrators. It must support discovery, quotes, bookings, sandbox payments, jobs, chat, signatures, invoices, reviews, disputes, role permissions, offline sync, camera, location, notifications, QR scanning, and accessible phone and tablet layouts.",
    );
    await page.getByRole("button", { name: /Mobile application/ }).click();
  } else {
    await recent.first().click();
  }

  await page.waitForTimeout(2200);
  await page.screenshot({ path: resolve(artifacts, "01-mobile-created.png"), fullPage: true });
  console.log(JSON.stringify({
    headings: await page.getByRole("heading").allTextContents(),
    buttons: await page.getByRole("button").allTextContents(),
    tabs: await page.getByRole("tab").allTextContents(),
    labels: await page.locator("label").allTextContents(),
  }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve(artifacts, "failure-mobile-create.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
