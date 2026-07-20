import { chromium } from "playwright";
import { resolve } from "node:path";

const views = [["Bookings", "Booking list", "Bookings"], ["Inventory", "Inventory list", "Inventory"]];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 120, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
async function applyRequest(region, request) {
  await region.getByRole("button", { name: "Ask Codex", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(request);
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  const approve = assistant.getByRole("button", { name: "Approve and apply" });
  await approve.waitFor({ timeout: 30_000 }); await approve.click();
  const analyze = assistant.getByRole("button", { name: "Analyze request" });
  await analyze.waitFor();
  for (let i = 0; i < 150 && await analyze.isDisabled(); i += 1) await page.waitForTimeout(200);
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  for (const [pageName, viewName, sourceName] of views) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    await page.locator(".layers button").filter({ hasText: new RegExp(`${viewName}$`) }).click();
    const actionsTab = page.getByRole("tab", { name: /Actions/ }); await actionsTab.click();
    let region = page.getByRole("region", { name: `Actions for ${viewName}` });
    if (!await region.getByText("Record updated", { exact: true }).locator("xpath=ancestor::article").getByRole("button", { name: "Open flow" }).count())
      await applyRequest(region, `Update a ${sourceName} record with a visual flow, refresh the list, and handle success and error.`);
    region = page.getByRole("region", { name: `Actions for ${viewName}` });
    if (!await region.getByText("Record deleted", { exact: true }).locator("xpath=ancestor::article").getByRole("button", { name: "Open flow" }).count())
      await applyRequest(region, `Delete a ${sourceName} record with confirmation and undo, refresh the list, and handle success and error.`);
  }
  await page.getByRole("button", { name: /^Flow/ }).first().click();
  await page.getByLabel("Active flow").selectOption({ label: "Delete Bookings" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "21-record-crud-flows.png"), fullPage: true });
  console.log(JSON.stringify({ flows: await page.getByLabel("Active flow").locator("option").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-record-flows.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
