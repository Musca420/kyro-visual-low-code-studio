import { chromium } from "playwright";
import { resolve } from "node:path";

const pages = ["Public home", "Sign in", "Search", "Service details", "Request quote", "Bookings", "Booking details", "Messages", "Chat", "Calendar", "Inventory", "Reviews", "Disputes", "Admin", "Reports", "Settings"];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 110, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  for (const name of pages) {
    await page.locator(".page-list button").filter({ hasText: name }).first().click();
    await page.locator(".layers button").first().click();
    await right.getByLabel("Background color value").first().fill("#0F1115");
    await right.getByLabel("Text color value").first().fill("#F3F4F6");
    if (await right.getByLabel("Quick inner spacing").count()) await right.getByLabel("Quick inner spacing").fill("24");
    if (await right.getByLabel("Quick corners").count()) await right.getByLabel("Quick corners").fill("0");
  }
  await page.locator(".page-list button").filter({ hasText: "Public home" }).first().click();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "29-web-roots-styled.png"), fullPage: true });
  await page.waitForTimeout(4000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-roots.png"), fullPage: true }); throw error; }
finally { await context.close(); }
