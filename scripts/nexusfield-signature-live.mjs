import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), { headless: false, slowMo: 140, viewport: { width: 1600, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(60_000);
const suffix = (value) => new RegExp(`${value}$`, "i");
async function add(type, name, label, parent) {
  const existing = page.locator(".layers button").filter({ hasText: suffix(name) });
  if (await existing.count()) await existing.click();
  else await page.locator(".palette button").filter({ hasText: suffix(type) }).first().click();
  const right = page.locator(".right-panel");
  await right.locator("label").filter({ hasText: "Element name" }).locator("input").fill(name);
  await right.locator("label").filter({ hasText: "Text or label" }).locator("input").fill(label);
  if (parent) await right.locator("label").filter({ hasText: /Inside|Dentro/ }).locator("select").selectOption({ label: parent });
}
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  if (!(await page.getByRole("button", { name: "Design" }).count())) await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.locator(".page-list button").filter({ hasText: "Booking details" }).first().click();
  await add("form", "Job completion form", "Finish the job");
  await add("signature", "Customer signature", "Customer approval", "Job completion form");
  const right = page.locator(".right-panel");
  const field = right.locator("label").filter({ hasText: "Data field name" }).locator("input"); if (await field.count()) await field.fill("customerSignature");
  await page.getByRole("button", { name: "Preview" }).click();
  await page.waitForTimeout(1400);
  const frame = page.locator("iframe"); const canvas = frame.contentFrame().locator("[data-signature-canvas]"); await canvas.scrollIntoViewIfNeeded();
  await canvas.hover({ position: { x: 30, y: 70 } }); await page.mouse.down();
  await canvas.hover({ position: { x: 90, y: 35 } }); await canvas.hover({ position: { x: 150, y: 95 } }); await canvas.hover({ position: { x: 220, y: 45 } }); await page.mouse.up();
  let stored = await frame.contentFrame().locator('input[name="customerSignature"]').inputValue();
  if (!stored) {
    await canvas.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const emit = (type, x, y, buttons) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "pen", isPrimary: true, button: 0, buttons, clientX: box.left + x, clientY: box.top + y }));
      emit("pointerdown", 30, 70, 1); emit("pointermove", 90, 35, 1); emit("pointermove", 150, 95, 1); emit("pointermove", 220, 45, 1); emit("pointerup", 220, 45, 0);
    });
    stored = await frame.contentFrame().locator('input[name="customerSignature"]').inputValue();
  }
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "23-signature-preview.png"), fullPage: true });
  console.log(JSON.stringify({ signatureStored: stored.startsWith("data:image/png;base64,"), length: stored.length }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) { await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-signature.png"), fullPage: true }); throw error; }
finally { await context.close(); }
