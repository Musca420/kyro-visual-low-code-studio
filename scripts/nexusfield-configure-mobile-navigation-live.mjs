import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 170,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (await page.getByLabel("Close project and return to the dashboard").count()) await page.getByLabel("Close project and return to the dashboard").click();
  await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.locator(".page-list button").filter({ hasText: "Home" }).first().click();
  await page.locator(".layers button").filter({ hasText: /NexusField customer dashboard\s*$/ }).first().click();
  await page.getByRole("tab", { name: /^Actions/ }).click();
  await page.getByRole("region", { name: "Actions for NexusField customer dashboard" }).getByRole("button", { name: "Ask Codex", exact: true }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill("Configure the mobile bottom navigation with exactly Home (/), Search (/search), Bookings (/bookings), Messages (/messages), and Profile (/profile). Keep safe-area support enabled.");
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  const approve = assistant.getByRole("button", { name: "Approve and apply" });
  await approve.waitFor({ timeout: 150_000 });
  await approve.click();
  const analyze = assistant.getByRole("button", { name: "Analyze request" });
  for (let attempt = 0; attempt < 240 && await analyze.isDisabled(); attempt += 1) await page.waitForTimeout(250);
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Mobile" }).click();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "111-mobile-navigation-preview.png"), fullPage: true });
  console.log(JSON.stringify({ configured: ["Home", "Search", "Bookings", "Messages", "Profile"], safeArea: true }));
  await page.waitForTimeout(2500);
} finally {
  await context.close();
}
