import { chromium } from "playwright";
import { resolve } from "node:path";

const bindings = [
  ["Dashboard", "Operations table", "Bookings"],
  ["Search", "Search results", "Services"], ["Search", "Search map", "Services"], ["Search", "Search loading", "Services"], ["Search", "Search empty", "Services"], ["Search", "Search error", "Services"],
  ["Service details", "Service availability", "Availability"],
  ["Bookings", "Booking table", "Bookings"], ["Bookings", "Booking loading", "Bookings"], ["Bookings", "Booking empty", "Bookings"], ["Bookings", "Booking error", "Bookings"],
  ["Booking details", "Customer signature", "Bookings"],
  ["Messages", "Conversation list", "Messages"], ["Messages", "Message thread", "Messages"],
  ["Chat", "Chat thread", "Messages"],
  ["Calendar", "Operations calendar", "Bookings"], ["Calendar", "Calendar agenda", "Bookings"],
  ["Inventory", "Inventory table", "Inventory"], ["Reviews", "Review list", "Reviews"], ["Disputes", "Dispute table", "Disputes"],
  ["Admin", "Admin operations table", "Bookings"], ["Reports", "Jobs chart", "Bookings"], ["Reports", "Revenue chart", "Sandbox payments"], ["Reports", "Team report table", "Users & roles"],
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 95, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
async function waitEnabled(locator) { for (let attempt = 0; attempt < 240 && await locator.isDisabled(); attempt += 1) await page.waitForTimeout(250); if (await locator.isDisabled()) throw new Error("Codex transaction did not finish"); }
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  for (const [pageName, componentName, sourceName] of bindings) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    await page.locator(".layers button").filter({ hasText: componentName }).first().click();
    const connection = page.locator(".right-panel .connection-summary");
    if (await connection.count() && (await connection.innerText()).includes("1 data")) continue;
    const selectedId = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id");
    await page.locator(`[data-component-id="${selectedId}"]`).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /Connect data/ }).click();
    const assistant = page.getByRole("region", { name: "Codex assistant" });
    await assistant.getByLabel("Request in plain language").fill(`Connect ${componentName} to the existing ${sourceName} data source.`);
    await assistant.getByRole("button", { name: "Analyze request" }).click();
    await assistant.getByRole("button", { name: "Approve and apply" }).waitFor({ timeout: 30_000 });
    await assistant.getByRole("button", { name: "Approve and apply" }).click();
    const analyze = assistant.getByRole("button", { name: "Analyze request" });
    await analyze.waitFor({ state: "visible", timeout: 30_000 }); await waitEnabled(analyze);
    await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  }
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "31-web-bindings.png"), fullPage: true });
  console.log(JSON.stringify({ bindings: bindings.length, saved: await page.getByText(/Saved automatically|Unsaved changes/).first().innerText() }, null, 2));
  await page.waitForTimeout(4000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-bindings.png"), fullPage: true }); throw error; }
finally { await context.close(); }
