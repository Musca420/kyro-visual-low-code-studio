import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 240,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  await page.bringToFront();
  const recent = page.getByText("NexusField Web", { exact: true });
  if (!(await recent.count())) {
    await page.getByRole("radio", { name: /Installable PWA/ }).check();
    await page.getByPlaceholder("My application").fill("NexusField Web");
    await page.getByPlaceholder(/organize tasks/).fill(
      "A responsive local-first field-service marketplace and operations PWA for customers, professionals, employees, managers, and administrators. It shares the NexusField domain and must support accessible public discovery, quotes, bookings, sandbox payments, jobs, realtime chat, signatures, invoices, reviews, disputes, role permissions, advanced tables, filters, pagination, offline synchronization, admin analytics, SEO, and self-hosting.",
    );
    await page.getByRole("button", { name: /Project dashboard/ }).click();
  } else {
    await recent.first().click();
  }
  await page.waitForTimeout(2400);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "26-web-created.png"), fullPage: true });
  console.log(JSON.stringify({ title: await page.title(), headings: await page.getByRole("heading").allTextContents(), tabs: await page.getByRole("tab").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-create.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
