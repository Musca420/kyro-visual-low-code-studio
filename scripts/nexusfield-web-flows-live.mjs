import { chromium } from "playwright";
import { resolve } from "node:path";

const requests = [
  ["Request quote", "Quote form", "Create a submit flow that saves form data in the existing Quotes data source with validation, success feedback, error handling, and refresh."],
  ["Reviews", "Review form", "Create a submit flow that saves form data in the existing Reviews data source with validation, success feedback, error handling, and refresh."],
  ["Disputes", "Dispute form", "Create a submit flow that saves form data in the existing Disputes data source with validation, success feedback, error handling, and refresh."],
  ["Messages", "Message form", "Create a submit flow that saves form data in the existing Messages data source with validation, success feedback, error handling, and refresh."],
  ["Chat", "Chat form", "Create a submit flow that saves form data in the existing Messages data source with validation, success feedback, error handling, and refresh."],
  ["Bookings", "Booking table", "Create an update record flow for the existing Bookings data source with refresh, success, and error handling."],
  ["Bookings", "Booking table", "Create a delete record flow for the existing Bookings data source with confirmation, refresh, success, error handling, and undo."],
  ["Inventory", "Inventory table", "Create an update record flow for the existing Inventory data source with refresh, success, and error handling."],
  ["Inventory", "Inventory table", "Create a delete record flow for the existing Inventory data source with confirmation, refresh, success, error handling, and undo."],
  ["Disputes", "Dispute table", "Create an update record flow for the existing Disputes data source with refresh, success, and error handling."],
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 110, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function waitEnabled(locator) { for (let attempt = 0; attempt < 240 && await locator.isDisabled(); attempt += 1) await page.waitForTimeout(250); if (await locator.isDisabled()) throw new Error("Codex transaction did not finish"); }
async function applyRequest(pageName, componentName, prompt) {
  await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
  const layer = page.locator(".layers button").filter({ hasText: new RegExp(`${escape(componentName)}\\s*$`, "i") }).first();
  await layer.click();
  await page.waitForFunction((button) => button.classList.contains("active"), await layer.elementHandle());
  const selectedId = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id");
  await page.locator(`[data-component-id="${selectedId}"]`).first().click({ button: "right", position: { x: 6, y: 6 } });
  const menu = page.getByRole("menu", { name: `Actions for ${componentName}` });
  await menu.waitFor();
  await menu.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(prompt);
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  await assistant.getByRole("button", { name: "Approve and apply" }).waitFor({ timeout: 30_000 });
  await assistant.getByRole("button", { name: "Approve and apply" }).click();
  const analyze = assistant.getByRole("button", { name: "Analyze request" }); await analyze.waitFor({ state: "visible", timeout: 30_000 }); await waitEnabled(analyze);
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  const cancel = page.getByRole("button", { name: "Cancel" });
  if (await cancel.count()) { await cancel.click(); await page.getByRole("region", { name: "Codex assistant" }).waitFor({ state: "hidden" }); }
  for (const request of requests) await applyRequest(...request);
  await page.getByRole("button", { name: /Flow/ }).click();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "33-web-node-red-flows.png"), fullPage: true });
  console.log(JSON.stringify({ transactions: requests.length, flowButtons: await page.locator(".flow-list button").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-flows.png"), fullPage: true }); throw error; }
finally { await context.close(); }
