import { chromium } from "playwright";
import { resolve } from "node:path";

const flows = [["Request quote","Quote form","Quotes","description"],["Reviews","Review form","Reviews","rating"],["Disputes","Dispute form","Disputes","reason"],["Chat","Message form","Messages","body"]];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 110, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
async function waitEnabled(locator) { for (let i = 0; i < 200 && await locator.isDisabled(); i += 1) await page.waitForTimeout(200); if (await locator.isDisabled()) throw new Error("Flow transaction timed out"); }
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  for (const [pageName, formName, sourceName, requiredField] of flows) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    const layer = page.locator(".layers button").filter({ hasText: new RegExp(`${formName}$`) });
    await layer.click();
    await page.locator(".layers button.active").filter({ hasText: new RegExp(`${formName}$`) }).waitFor();
    const actionsTab = page.getByRole("tab", { name: /Actions/ });
    if (Number((await actionsTab.innerText()).match(/\d+/)?.[0] ?? 0) > 0) continue;
    await actionsTab.click();
    await page.getByRole("region", { name: `Actions for ${formName}` }).getByRole("button", { name: "Ask Codex", exact: true }).click();
    const assistant = page.getByRole("region", { name: "Codex assistant" });
    await assistant.getByLabel("Request in plain language").fill(`Create a submit flow to save ${sourceName} data, validate ${requiredField}, refresh the matching list, and handle success and error.`);
    await assistant.getByRole("button", { name: "Analyze request" }).click();
    await assistant.getByRole("button", { name: "Approve and apply" }).waitFor({ timeout: 30_000 });
    await assistant.getByRole("button", { name: "Approve and apply" }).click();
    const analyze = assistant.getByRole("button", { name: "Analyze request" });
    await analyze.waitFor({ state: "visible", timeout: 30_000 }); await waitEnabled(analyze);
    await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  }
  await page.getByRole("button", { name: /^Flow/ }).first().click();
  await page.waitForTimeout(1200);
  await page.getByLabel("Active flow").selectOption({ label: "Create Quotes" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "20-node-red-flows.png"), fullPage: true });
  console.log(JSON.stringify({ flowOptions: await page.getByLabel("Active flow").locator("option").allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-create-flows.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
