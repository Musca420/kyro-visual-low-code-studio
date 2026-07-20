import { chromium } from "playwright";
import { resolve } from "node:path";

const duplicates = [
  "Submit review with validation",
  "Submit dispute v2",
  "Submit validated message",
  "Submit quote request v2",
  "Submit dispute v3",
  "Submit message with validation",
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 180,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  await page.getByRole("button", { name: /Flow/ }).click();
  const select = page.locator("label").filter({ hasText: "Active flow" }).locator("select");
  for (const name of duplicates) {
    if (!(await select.locator("option").filter({ hasText: name }).count())) continue;
    await select.selectOption({ label: name });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete flow" }).click();
    await page.waitForTimeout(500);
  }
  await page.getByText("Flow editor", { exact: true }).waitFor();
  await page.locator(".react-flow").waitFor({ timeout: 60_000 });
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "33-web-node-red-flows.png"), fullPage: true });
  console.log(JSON.stringify({ flows: await select.locator("option").allTextContents() }, null, 2));
  await page.waitForTimeout(3000);
} finally {
  await context.close();
}
