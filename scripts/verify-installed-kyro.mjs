import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const page = browser.contexts()[0]?.pages()[0];
if (!page) throw new Error("Kyro window is not available");
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("artifacts", { recursive: true });
await page.bringToFront();
await page.waitForTimeout(700);
await page.screenshot({ path: "artifacts/kyro-installed-home.png" });

if (!(await page.getByRole("button", { name: "Design" }).isVisible().catch(() => false))) {
  const preferred = page.locator(".project-open").filter({ hasText: "DailyFlow" });
  if (await preferred.count()) await preferred.first().click();
  else {
    const projects = page.locator(".project-open");
    if (await projects.count()) await projects.first().click();
    else {
      await page.getByLabel("Project name").fill("Installed Kyro Verification");
      await page.getByLabel("Project goal").fill("Verify visual design, actions, data and preview without code");
      await page.getByRole("button", { name: "Task list A working vertical slice" }).click();
    }
  }
  await page.getByRole("button", { name: "Design" }).waitFor({ state: "visible", timeout: 15_000 });
}

await page.getByRole("button", { name: "Design" }).click();
await page.waitForTimeout(500);
const canvasElements = page.getByTestId("component-title");
if (!(await canvasElements.count())) throw new Error("The opened project has no visual title element");
await canvasElements.first().click();
await page.screenshot({ path: "artifacts/kyro-installed-selected.png" });
const actionsTab = page.getByRole("tab", { name: /Actions/ });
await actionsTab.click();
await page.waitForTimeout(500);
await page.screenshot({ path: "artifacts/kyro-installed-actions.png" });
const actionsVisible = await page.locator(".component-actions").isVisible();

await page.getByRole("button", { name: "Flow" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "artifacts/kyro-installed-flow.png" });
const contextPickerVisible = await page.locator(".flow-context-picker").isVisible();
const title = await page.title();
console.log(JSON.stringify({ title, actionsVisible, contextPickerVisible, consoleErrors: errors }, null, 2));
await browser.close();
