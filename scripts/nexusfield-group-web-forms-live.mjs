import { chromium } from "playwright";
import { resolve } from "node:path";

const forms = [
  ["Sign in", "Sign in form", [["Sign in email", "email", "email"], ["Sign in password", "password", "password"], ["Sign in role", "role", null], ["Sign in submit", null, "submit"]]],
  ["Request quote", "Quote form", [["Quote subject", "title", "text"], ["Quote description", "description", null], ["Quote priority", "priority", null], ["Quote date", "preferredDate", "date"], ["Coupon code", "coupon", "text"], ["Quote submit", null, "submit"]]],
  ["Reviews", "Review form", [["Review rating", "rating", null], ["Review comment", "comment", null], ["Review submit", null, "submit"]]],
  ["Disputes", "Dispute form", [["Dispute reason", "reason", null], ["Dispute details", "details", null], ["Dispute submit", null, "submit"]]],
  ["Messages", "Message form", [["Message input", "body", "text"], ["Send message", null, "submit"]]],
  ["Chat", "Chat form", [["Chat message", "body", "text"], ["Chat send", null, "submit"]]],
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 100, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const right = page.locator(".right-panel");
async function field(label) { return right.locator("label").filter({ hasText: label }).first().locator("input,select").first(); }
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Web/ }).click();
  for (const [pageName, formName, children] of forms) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    if (!(await page.locator(".layers button").filter({ hasText: formName }).count())) {
      await page.locator(".palette button").filter({ hasText: /form$/i }).first().click();
      await (await field("Element name")).fill(formName); await (await field("Text or label")).fill(formName);
      await right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select").selectOption({ label: `${pageName} content` }).catch(() => undefined);
    }
    const parentLabel = `${pageName} content / ${formName}`;
    for (const [componentName, dataField, behavior] of children) {
      await page.locator(".layers button").filter({ hasText: componentName }).first().click();
      if (dataField && await (await field("Data field name")).count()) await (await field("Data field name")).fill(dataField);
      if (["email", "password", "text", "date"].includes(behavior)) { const type = await field("Field type"); if (await type.count()) await type.selectOption(behavior); }
      if (behavior === "submit") { const buttonBehavior = await field("Button behavior"); if (await buttonBehavior.count()) await buttonBehavior.selectOption("submit"); }
      await right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select").selectOption({ label: parentLabel }).catch(() => undefined);
    }
  }
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "32-web-forms.png"), fullPage: true });
  await page.waitForTimeout(4000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-forms.png"), fullPage: true }); throw error; }
finally { await context.close(); }
