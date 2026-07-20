import { chromium } from "playwright";
import { resolve } from "node:path";

const bindings = [
  ["Search", "Search results", "Services"], ["Search", "Nearby map", "Services"], ["Search", "Search loading", "Services"], ["Search", "Search empty", "Services"], ["Search", "Search error", "Services"],
  ["Service details", "Service availability", "Availability"],
  ["Bookings", "Booking list", "Bookings"], ["Bookings", "Booking calendar", "Bookings"], ["Bookings", "Bookings loading", "Bookings"], ["Bookings", "Bookings empty", "Bookings"], ["Bookings", "Bookings error", "Bookings"],
  ["Messages", "Conversation list", "Messages"], ["Messages", "Messages loading", "Messages"], ["Messages", "Messages empty", "Messages"], ["Messages", "Messages error", "Messages"],
  ["Chat", "Chat messages", "Messages"], ["Calendar", "Team calendar", "Bookings"], ["Calendar", "Calendar agenda", "Bookings"],
  ["Inventory", "Inventory list", "Inventory"], ["Inventory", "Inventory empty", "Inventory"],
  ["Reviews", "Review list", "Reviews"], ["Disputes", "Dispute list", "Disputes"],
  ["Admin", "Admin table", "Bookings"], ["Reports", "Jobs chart", "Bookings"], ["Reports", "Revenue chart", "Sandbox payments"],
];

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 90, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
async function waitEnabled(locator) {
  for (let attempt = 0; attempt < 240 && await locator.isDisabled(); attempt += 1) await page.waitForTimeout(250);
  if (await locator.isDisabled()) throw new Error("Codex transaction did not finish");
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.getByRole("button", { name: "Design" }).click();
  for (const [pageName, componentName, sourceName] of bindings) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    await page.locator(".layers button").filter({ hasText: componentName }).click();
    const connectionSummary = (await page.locator(".right-panel .connection-summary").innerText()).replace(/\s+/g, " ");
    if (/\b1 data sources\b/.test(connectionSummary)) continue;
    const selectedId = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id");
    await page.locator(`[data-component-id="${selectedId}"]`).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /Connect data/ }).click();
    const assistant = page.getByRole("region", { name: "Codex assistant" });
    await assistant.getByLabel("Request in plain language").fill(`Connect ${componentName} to the existing ${sourceName} data source.`);
    await assistant.getByRole("button", { name: "Analyze request" }).click();
    const approvalCard = assistant.locator(".approval-card");
    await approvalCard.waitFor({ timeout: 60_000 });
    const done = approvalCard.getByRole("button", { name: "Done" });
    if (await done.count()) await done.click();
    else await approvalCard.getByRole("button", { name: "Approve and apply" }).click();
    const analyze = assistant.getByRole("button", { name: "Analyze request" });
    await analyze.waitFor({ state: "visible", timeout: 60_000 });
    await waitEnabled(analyze);
    await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "18-bindings-complete.png"), fullPage: true });
  console.log(JSON.stringify({ requested: bindings.length, revisions: await page.getByText(/Saved automatically|Unsaved changes/).first().innerText() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-bind-data.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
