import { chromium } from "playwright";
import { resolve } from "node:path";
const actions = [
  ["Booking details", "Complete job", "Take a completion photo with the device camera, request permission, and handle success and errors."],
  ["Search", "Use current location", "Use the current device location, request geolocation permission, and handle success and errors."],
  ["Settings", "Notification setting", "Register for push notifications, request notification permission, and handle success and errors."],
  ["Calendar", "Add appointment", "On click schedule a local notification after 2 seconds with title Appointment reminder and message Your next job is ready."],
  ["Booking details", "Booking detail title", "Open this booking page from a deep link and show visible feedback."],
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 130, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(60_000); const right = page.locator(".right-panel");
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const end = (value) => new RegExp(`${escape(value)}\\s*$`, "i");
async function field(label) { return right.locator("label").filter({ hasText: label }).first().locator("input,textarea").first(); }
async function waitEnabled(locator) { for (let i = 0; i < 240 && await locator.isDisabled(); i += 1) await page.waitForTimeout(250); if (await locator.isDisabled()) throw new Error("Codex transaction did not finish"); }
async function apply(pageName, componentName, prompt) {
  await page.locator(".page-list button").filter({ hasText: pageName }).first().click(); const layer = page.locator(".layers button").filter({ hasText: end(componentName) }).first(); await layer.click(); await page.waitForFunction((button) => button.classList.contains("active"), await layer.elementHandle());
  const actionsTab = page.getByRole("tab", { name: /Actions/ });
  if (Number((await actionsTab.innerText()).match(/\d+/)?.[0] ?? 0) > 0) return;
  const selectedId = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id"); await page.locator(`[data-component-id="${selectedId}"]`).first().click({ button: "right", position: { x: 6, y: 6 } });
  const menu = page.getByRole("menu", { name: `Actions for ${componentName}` }); await menu.waitFor(); await menu.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" }); await assistant.getByLabel("Request in plain language").fill(prompt); await assistant.getByRole("button", { name: "Analyze request" }).click();
  await assistant.getByRole("button", { name: "Approve and apply" }).waitFor({ timeout: 90_000 }); await assistant.getByRole("button", { name: "Approve and apply" }).click(); const analyze = assistant.getByRole("button", { name: "Analyze request" }); await analyze.waitFor(); await waitEnabled(analyze); await assistant.getByRole("button", { name: "Close Codex panel" }).click();
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" }); if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  const cancel = page.getByRole("button", { name: "Cancel" }); if (await cancel.count()) { await cancel.click(); await page.getByRole("region", { name: "Codex assistant" }).waitFor({ state: "hidden" }); }
  await page.locator(".page-list button").filter({ hasText: "Search" }).first().click(); if (!(await page.locator(".layers button").filter({ hasText: end("Use current location") }).count())) { await page.locator(".palette button").filter({ hasText: /button$/i }).first().click(); await (await field("Element name")).fill("Use current location"); await (await field("Text or label")).fill("Use my current location"); const parent = right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select"); if (await parent.count()) await parent.selectOption({ label: "Search content" }).catch(() => undefined); }
  for (const item of actions) await apply(...item);
  await page.getByRole("button", { name: /^Flow/ }).click(); const flowOptions = await page.getByLabel("Active flow").locator("option").allTextContents(); const deepLinkFlow = flowOptions.find((label) => /deep.?link/i.test(label)); if (!deepLinkFlow) throw new Error("Booking deep-link flow is missing"); await page.getByLabel("Active flow").selectOption({ label: deepLinkFlow }); await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "46-mobile-native-suite.png"), fullPage: true });
  console.log(JSON.stringify({ flows: flowOptions }, null, 2)); await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-mobile-native-suite.png"), fullPage: true }); throw error; } finally { await context.close(); }
