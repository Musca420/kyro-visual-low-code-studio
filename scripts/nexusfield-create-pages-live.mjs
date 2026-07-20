import { chromium } from "playwright";
import { resolve } from "node:path";

const screens = [
  ["Onboarding", "/onboarding"],
  ["Sign in", "/sign-in"],
  ["Search", "/search"],
  ["Service details", "/services/:id"],
  ["Request quote", "/quotes/new"],
  ["Bookings", "/bookings"],
  ["Booking details", "/bookings/:id"],
  ["Messages", "/messages"],
  ["Chat", "/messages/:id"],
  ["Calendar", "/calendar"],
  ["Inventory", "/inventory"],
  ["Reviews", "/reviews"],
  ["Disputes", "/disputes"],
  ["Admin", "/admin"],
  ["Reports", "/reports"],
  ["Settings", "/settings"],
];

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 180, viewport: { width: 1600, height: 900 } });
const page = context.pages()[0] ?? await context.newPage();
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  for (const [name, route] of screens) {
    if (await page.getByRole("button", { name: new RegExp(`^▱${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).count()) continue;
    await page.getByRole("button", { name: /Add page/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Screen name").fill(name);
    await dialog.getByLabel("Route").fill(route);
    await dialog.getByRole("button", { name: "Create screen" }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "11-mobile-pages-created.png"), fullPage: true });
  console.log(JSON.stringify({ pages: await page.locator(".page-list button").allTextContents(), total: await page.locator(".page-list button").count() }, null, 2));
  await page.waitForTimeout(4000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-create-pages.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
