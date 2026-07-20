import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 140, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
const end = (value) => new RegExp(`${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

async function open(name) {
  if (await page.getByRole("button", { name: "Close project and return to the dashboard" }).count()) await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
}
async function apply(pageName, componentName, prompt) {
  await page.getByRole("button", { name: "Design" }).click();
  await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
  const layer = page.locator(".layers button").filter({ hasText: end(componentName) }).first();
  await layer.click();
  const id = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id");
  await page.locator(`[data-component-id="${id}"]`).first().click({ button: "right", position: { x: 8, y: 8 } });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(prompt);
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  await assistant.getByRole("button", { name: "Approve and apply" }).click();
  const analyze = assistant.getByRole("button", { name: "Analyze request" });
  for (let i = 0; i < 120 && await analyze.isDisabled(); i++) await page.waitForTimeout(250);
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
}

try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  await open("NexusField Web");
  await apply("Booking details", "Sandbox payment", "Record a sandbox payment data record, only customer or admin may run it, with success and error paths.");
  await apply("Disputes", "Dispute policy", "Record a sandbox payment refund record, only admin or manager may run it, with success and error paths.");
  await page.getByRole("button", { name: /^Flow/ }).click(); await page.waitForTimeout(1600);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "49-web-guarded-domain-flows.png"), fullPage: true });
  await open("NexusField Mobile");
  await apply("Home", "Upcoming booking", "Record a sandbox payment data record, only customer or admin may run it, with success and error paths.");
  await apply("Tasks", "Completed job", "Record an audit data record for job completion, only professional, employee or manager may run it, with success and error paths.");
  await page.getByRole("button", { name: /^Flow/ }).click(); await page.waitForTimeout(1600);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "50-mobile-guarded-domain-flows.png"), fullPage: true });
  console.log(JSON.stringify({ web: 2, mobile: 2, guarded: true, dataMutations: true }));
  await page.waitForTimeout(2500);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-domain-actions.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
