import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 130, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.locator(".page-list button").filter({ hasText: "Inventory" }).first().click();
  await page.locator(".layers button").filter({ hasText: /Scan inventory code$/ }).click();
  const actions = page.getByRole("tab", { name: /Actions/ });
  if (Number((await actions.innerText()).match(/\d+/)?.[0] ?? 0) === 0) {
    await actions.click();
    await page.getByRole("region", { name: "Actions for Scan inventory code" }).getByRole("button", { name: "Ask Codex", exact: true }).click();
    const assistant = page.getByRole("region", { name: "Codex assistant" });
    await assistant.getByLabel("Request in plain language").fill("Scan a QR or barcode with the device camera, request permission, and handle success and errors.");
    await assistant.getByRole("button", { name: "Analyze request" }).click();
    const approve = assistant.getByRole("button", { name: "Approve and apply" }); await approve.waitFor({ timeout: 90_000 }); await approve.click();
    const analyze = assistant.getByRole("button", { name: "Analyze request" }); await analyze.waitFor();
    for (let i = 0; i < 150 && await analyze.isDisabled(); i += 1) await page.waitForTimeout(200);
    await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  }
  await page.getByRole("button", { name: "Publish" }).click();
  const approval = page.getByRole("button", { name: "Review and approve" });
  await approval.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  if (await approval.count()) { await approval.click(); await page.getByRole("button", { name: "Revoke" }).waitFor(); }
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "22-native-extension-approved.png"), fullPage: true });
  console.log(JSON.stringify({ approved: await page.getByText("Approved", { exact: true }).count(), revoke: await page.getByRole("button", { name: "Revoke" }).count(), package: await page.getByText(/barcode-scanning@/).allTextContents() }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-native-flow.png"), fullPage: true }); throw error; }
finally { await context.close(); }
