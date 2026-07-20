import { chromium } from "playwright";
import { resolve } from "node:path";
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 130, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
const end = (value) => new RegExp(`${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
async function field(label) { return right.locator("label").filter({ hasText: label }).first().locator("input,textarea").first(); }
async function rename(oldName, newName, label) { const layer = page.locator(".layers button").filter({ hasText: end(oldName) }).first(); if (!(await layer.count())) return; await layer.click(); await (await field("Element name")).fill(newName); await (await field("Text or label")).fill(label); }
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" }); if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  await page.locator(".page-list button").filter({ hasText: "Dashboard" }).first().click();
  await rename("Sidebar", "NexusField sidebar", "NexusField · Dashboard · Bookings · Team · Reports · Settings");
  await rename("Topbar", "Operations topbar", "Good morning, Alex · Online · Notifications");
  await rename("Dashboard title", "Operations title", "Operations overview");
  await rename("Total projects", "Users KPI", "1,248 active users");
  await rename("In progress", "Active jobs KPI", "43 jobs in progress");
  await rename("Completed", "Completed jobs KPI", "84 completed this month");
  await rename("Search", "Dashboard search", "Search bookings, people, or teams");
  await rename("Status filter", "Dashboard status filter", "All statuses");
  await rename("Projects table", "Operations table", "Recent bookings and work orders");
  if (!(await page.locator(".layers button").filter({ hasText: end("Sandbox volume KPI") }).count())) {
    await page.locator(".palette button").filter({ hasText: /card$/i }).first().click();
    await (await field("Element name")).fill("Sandbox volume KPI"); await (await field("Text or label")).fill("€82k sandbox volume");
    if (await right.getByLabel("Background color value").count()) await right.getByLabel("Background color value").first().fill("#171A1F");
    if (await right.getByLabel("Text color value").count()) await right.getByLabel("Text color value").first().fill("#F3F4F6");
  }
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "34-web-dashboard.png"), fullPage: true });
  await page.waitForTimeout(4000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-dashboard.png"), fullPage: true }); throw error; } finally { await context.close(); }
