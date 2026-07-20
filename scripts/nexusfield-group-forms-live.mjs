import { chromium } from "playwright";
import { resolve } from "node:path";

const forms = [
  ["Sign in", "Sign in form", [["Email","email","email"],["Password","password","password"],["Sign in action",null,"submit"]]],
  ["Request quote", "Quote form", [["Quote subject","title","text"],["Quote description","description",null],["Quote priority","priority",null],["Preferred date","preferredDate","date"],["Submit quote",null,"submit"]]],
  ["Reviews", "Review form", [["Review rating","rating",null],["Review text","comment",null],["Submit review",null,"submit"]]],
  ["Disputes", "Dispute form", [["Dispute reason","reason",null],["Dispute details","details",null],["Submit dispute",null,"submit"]]],
  ["Chat", "Message form", [["Chat input","body","text"],["Send message",null,"submit"]]],
];
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 100, viewport: { width: 1600, height: 900 } });
const page = context.pages()[0] ?? await context.newPage();
const right = page.locator(".right-panel");
async function field(label) { return right.locator("label").filter({ hasText: label }).first().locator("input,select").first(); }
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  for (const [pageName, formName, children] of forms) {
    await page.locator(".page-list button").filter({ hasText: pageName }).first().click();
    if (!(await page.locator(".layers button").filter({ hasText: formName }).count())) {
      await page.locator(".palette button").filter({ hasText: /form$/i }).first().click();
      await (await field("Element name")).fill(formName);
      await (await field("Text or label")).fill(formName);
      const rootName = `${pageName} content`;
      await right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select").selectOption({ label: rootName }).catch(() => undefined);
    }
    const parentLabel = `${pageName} content / ${formName}`;
    for (const [componentName, dataField, behavior] of children) {
      await page.locator(".layers button").filter({ hasText: componentName }).click();
      if (dataField) await (await field("Data field name")).fill(dataField);
      if (behavior === "email" || behavior === "password" || behavior === "text" || behavior === "date") {
        const type = await field("Field type");
        if (await type.count()) await type.selectOption(behavior);
      }
      if (behavior === "submit") {
        const buttonBehavior = await field("Button behavior");
        if (await buttonBehavior.count()) await buttonBehavior.selectOption("submit");
      }
      await right.locator("label").filter({ hasText: /Inside|Dentro/ }).first().locator("select").selectOption({ label: parentLabel });
    }
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "19-forms-grouped.png"), fullPage: true });
  await page.waitForTimeout(4000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-group-forms.png"), fullPage: true });
  throw error;
} finally { await context.close(); }
