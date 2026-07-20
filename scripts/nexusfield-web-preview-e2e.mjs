import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 150,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(45_000);
const consoleErrors = [], httpErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", (response) => { if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() }); });
async function openPreview(pageName) {
  if (await page.getByRole("button", { name: "Design" }).count()) await page.getByRole("button", { name: "Design" }).click();
  await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
  await page.getByRole("button", { name: "Preview" }).click();
  await page.locator('iframe[title="Preview isolata"]').waitFor();
  return page.locator('iframe[title="Preview isolata"]').contentFrame();
}
async function fillFirst(frame, label, value) { const control = frame.getByLabel(label).first(); if (await control.count()) await control.fill(value); else throw new Error(`Preview field not found: ${label}`); }
async function submitPage(pageName, fields, buttonName, shot) {
  const frame = await openPreview(pageName);
  for (const [label, value] of fields) await fillFirst(frame, label, value);
  await frame.getByRole("button", { name: buttonName }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", shot), fullPage: true });
  return frame.locator('[role="status"], [role="alert"], .status').allTextContents();
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (await page.getByLabel("Close project and return to the dashboard").count()) await page.getByLabel("Close project and return to the dashboard").click();
  await page.getByRole("button", { name: /NexusField Web/ }).click();
  const results = {};
  results.quote = await submitPage("Request quote", [["What do you need?", "Boiler inspection"], ["Describe the work", "Annual inspection and pressure check"], ["Preferred date", "2026-07-22"], ["Coupon code", "BUILDWEEK"]], "Send quote request", "35-preview-quote.png");
  results.review = await submitPage("Reviews", [["Share your experience", "Fast, clear, and professional service."]], "Publish review", "36-preview-review.png");
  results.dispute = await submitPage("Disputes", [["Explain what happened", "The agreed completion document was missing."]], "Submit dispute", "37-preview-dispute.png");
  results.message = await submitPage("Messages", [["Write a message", "Can you confirm tomorrow at 09:30?"]], "Send", "38-preview-message.png");
  const publicFrame = await openPreview("Public home");
  await page.getByRole("button", { name: "Tablet" }).click(); await page.waitForTimeout(600); await page.screenshot({ path: resolve("artifacts", "nexusfield", "39-web-tablet.png"), fullPage: true });
  await page.getByRole("button", { name: "Mobile" }).click(); await page.waitForTimeout(600); await page.screenshot({ path: resolve("artifacts", "nexusfield", "40-web-mobile.png"), fullPage: true });
  const focusableCount = await publicFrame.locator('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').count();
  await publicFrame.locator("body").evaluate((body) => { body.tabIndex = -1; body.focus(); });
  await page.keyboard.press("Tab");
  const focused = await publicFrame.locator("html").evaluate(() => { const element = document.activeElement; return { tag: element?.tagName, text: element?.textContent?.slice(0, 80), label: element?.getAttribute("aria-label") }; });
  console.log(JSON.stringify({ results, focusableCount, focused, consoleErrors, httpErrors }, null, 2));
  const blockingHttp = httpErrors.filter((entry) => !/favicon\.ico(?:\?|$)/.test(entry.url));
  const blockingConsole = consoleErrors.filter((entry) => !/^Failed to load resource: the server responded with a status of 404/.test(entry));
  if (blockingConsole.length || blockingHttp.length) throw new Error(`Preview runtime errors: ${blockingConsole.join(" | ")} · ${JSON.stringify(blockingHttp)}`);
  if (!focusableCount || focused.tag === "BODY") throw new Error(`Keyboard focus did not enter the preview: ${JSON.stringify({ focusableCount, focused })}`);
  await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-preview-e2e.png"), fullPage: true }); throw error; }
finally { await context.close(); }
