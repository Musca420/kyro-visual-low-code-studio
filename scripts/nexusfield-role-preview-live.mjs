import { chromium } from "playwright";
import { resolve } from "node:path";
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 170, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(60_000);
async function setRole(role) {
  await page.getByRole("button", { name: /^Flow/ }).click();
  await page.getByLabel("Active flow").selectOption({ label: "Record sandbox payment" });
  await page.locator(".react-flow__node").filter({ hasText: /Require customer or admin/i }).click();
  await page.getByLabel("Simulated preview role").selectOption(role);
  await page.waitForTimeout(800);
}
async function run(shot) {
  await page.getByRole("button", { name: "Design" }).click();
  await page.locator(".page-list button").filter({ hasText: "Booking details" }).first().click();
  await page.getByRole("button", { name: "Preview" }).click();
  const frame = page.locator('iframe[title="Preview isolata"]').contentFrame();
  await frame.getByText("€145 protected", { exact: true }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", shot), fullPage: true });
  return frame.locator("body").innerText();
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  await setRole("customer"); const allowed = await run("51-role-allowed.png");
  await setRole("viewer"); const denied = await run("52-role-denied.png");
  if (!allowed.toLowerCase().includes("recorded successfully")) throw new Error("Allowed mutation did not complete");
  if (!/permission|requires/i.test(denied)) throw new Error("Denied mutation was not reported");
  await setRole("customer");
  console.log(JSON.stringify({ allowed, denied }, null, 2));
  await page.waitForTimeout(3000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-role-preview.png"), fullPage: true }); throw error; }
finally { await context.close(); }
