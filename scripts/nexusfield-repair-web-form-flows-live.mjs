import { chromium } from "playwright";
import { resolve } from "node:path";

const forms = [
  { page: "Request quote", component: "Quote form", flow: "Submit quote request", next: "Read quote form", addEvent: true },
  { page: "Reviews", component: "Review form", flow: "Submit review", next: "Read review form", addEvent: true },
  { page: "Disputes", component: "Dispute form", flow: "Submit dispute", next: "Read dispute form", addEvent: true },
  { page: "Messages", component: "Message form", flow: "Submit message", addEvent: false },
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 160,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  await page.getByRole("button", { name: /Flow/ }).click();
  for (const item of forms.filter((value) => value.addEvent)) {
    await page.getByLabel("Active flow").selectOption({ label: item.flow });
    await page.locator(".react-flow").waitFor();
    if (!(await page.locator(".react-flow__node").filter({ hasText: /^event/ }).count())) await page.getByRole("button", { name: "Event", exact: true }).click();
    const eventNode = page.locator(".react-flow__node").filter({ hasText: /^event/ }).last();
    await eventNode.click();
    await page.locator("label").filter({ hasText: "Visible name" }).locator("input").fill(`${item.component} submitted`);
    await page.locator("label").filter({ hasText: "When should it run?" }).locator("select").selectOption("submit");
    await page.locator("label").filter({ hasText: /^Element/ }).last().locator("select").selectOption({ label: `${item.component} · form` });
    await page.locator("label").filter({ hasText: "Next step" }).locator("select").selectOption({ label: item.next });
  }
  await page.getByRole("button", { name: "Design" }).click();
  for (const item of forms) {
    await page.locator(".page-list button").filter({ hasText: item.page }).first().click();
    await page.locator(".layers button").filter({ hasText: new RegExp(`${item.component}\\s*$`) }).first().click();
    const actions = page.getByRole("tab", { name: /^Actions/ });
    await actions.click();
    const reuse = page.getByLabel("Reusable flow for Form submitted");
    if (await reuse.count()) {
      await reuse.selectOption({ label: item.flow });
      await reuse.locator("xpath=ancestor::div[contains(@class,'reuse-flow')]").getByRole("button", { name: "Connect" }).click();
    }
  }
  await page.getByRole("button", { name: /Flow/ }).click();
  await page.getByLabel("Active flow").selectOption({ label: "Submit quote request" });
  await page.locator(".react-flow").waitFor();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "33-web-node-red-flows.png"), fullPage: true });
  console.log(JSON.stringify({ repaired: forms.map(({ page, component, flow }) => ({ page, component, flow })) }, null, 2));
  await page.waitForTimeout(3000);
} finally {
  await context.close();
}
