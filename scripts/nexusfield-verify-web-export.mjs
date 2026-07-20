import { chromium } from "playwright";
import { resolve } from "node:path";
const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-export-browser-profile"), { headless: false, slowMo: 180, viewport: { width: 1440, height: 900 }, recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1440, height: 900 } } });
const page = context.pages()[0] ?? await context.newPage(); page.setDefaultTimeout(45_000);
const errors = [], httpErrors = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); page.on("response", (response) => { if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() }); });
try {
  await page.goto("http://127.0.0.1:43220", { waitUntil: "networkidle" });
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  const routes = await page.locator('nav[aria-label="Pages"] a').allTextContents();
  await page.locator('a[href="#/home"]').click(); await page.getByText("Trusted professionals, right when you need them", { exact: true }).waitFor();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "42-web-export-desktop.png"), fullPage: true });
  const input = page.locator('input[name]').first(); await input.focus(); await input.press("Tab"); const focusTag = await page.locator("html").evaluate(() => document.activeElement?.tagName);
  await page.setViewportSize({ width: 820, height: 1100 }); await page.screenshot({ path: resolve("artifacts", "nexusfield", "43-web-export-tablet.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: resolve("artifacts", "nexusfield", "44-web-export-mobile.png"), fullPage: true });
  const registration = await page.evaluate(async () => { const ready = await navigator.serviceWorker.ready; return { scope: ready.scope, controlled: Boolean(navigator.serviceWorker.controller) }; });
  await context.setOffline(true); await page.reload({ waitUntil: "domcontentloaded" }); await page.getByText("Trusted professionals, right when you need them", { exact: true }).waitFor();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "45-web-export-offline.png"), fullPage: true }); await context.setOffline(false);
  console.log(JSON.stringify({ title: await page.title(), routes: routes.length, manifest, registration, focusTag, offline: true, errors, httpErrors }, null, 2));
  if (routes.length < 12 || !manifest || errors.length) throw new Error(`Export verification failed: ${JSON.stringify({ routes: routes.length, manifest, errors })}`);
  await page.waitForTimeout(5000);
} catch (error) { await context.setOffline(false).catch(() => undefined); await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-web-export-runtime.png"), fullPage: true }); throw error; }
finally { await context.close(); }
