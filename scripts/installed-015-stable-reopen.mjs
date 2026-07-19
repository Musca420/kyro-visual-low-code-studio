import { chromium } from "playwright";

let browser;
for (let attempt = 0; attempt < 40 && !browser; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  browser = await chromium.connectOverCDP("http://127.0.0.1:9333").catch(() => undefined);
}
if (!browser) throw new Error("Frontend Editor 0.1.5 non raggiungibile dopo il riavvio");
const page = browser.contexts()[0].pages()[0];
await page.bringToFront();
await page.waitForTimeout(2200);
await page.locator("button").filter({ hasText: "Orbit Studio Stable" }).first().click();
await page.waitForTimeout(2200);
await page.getByRole("button", { name: "Preview" }).click();
await page.getByRole("button", { name: "desktop" }).click();
await page.waitForTimeout(2200);
await page.screenshot({ path: "artifacts/installed-015-stable-reopened.png" });
console.log("Orbit Studio Stable riaperto dopo la chiusura completa dell'app");
