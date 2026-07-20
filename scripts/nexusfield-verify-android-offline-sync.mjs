import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const adb = resolve(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe");
const serial = process.env.ANDROID_SERIAL || "y9l7tsjrjrfir4pv";
const device = (...args) => execFileSync(adb, ["-s", serial, "shell", ...args], { stdio: "pipe" });
const browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
const context = browser.contexts()[0];
const page = context.pages()[0];

const count = () => page.evaluate(async () => {
  const token = localStorage.getItem("frontend-editor-session") || "";
  const response = await fetch("http://127.0.0.1:8787/records", { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Records request failed (${response.status})`);
  return (await response.json()).length;
});

try {
  const gate = page.locator("#auth-gate");
  if (await gate.isVisible()) {
    await gate.getByLabel("Email", { exact: true }).fill("offline@kyro.local");
    await gate.getByLabel("Password", { exact: true }).fill("KyroOffline2026");
    await gate.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(800);
    if (!(await page.locator("#protected-app:not([hidden])").isVisible()))
      await gate.getByRole("button", { name: "Create the first account" }).click();
    await page.locator("#protected-app:not([hidden])").waitFor();
  }
  const before = await count();
  await page.getByRole("link", { name: "Tasks" }).click();
  const action = page.getByText(/Heating repair/);
  await action.waitFor();

  device("svc", "wifi", "disable");
  device("svc", "data", "disable");
  await page.waitForFunction(() => !navigator.onLine, undefined, { timeout: 20_000 });
  await action.click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kyro-offline-mutations") || "[]").length === 1);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "106-android-offline-mutation-queued.png") });

  device("svc", "wifi", "enable");
  device("svc", "data", "enable");
  await page.waitForFunction(() => navigator.onLine, undefined, { timeout: 30_000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kyro-offline-mutations") || "[]").length === 0, undefined, { timeout: 30_000 });
  await page.waitForFunction(async (expected) => {
    const token = localStorage.getItem("frontend-editor-session") || "";
    const response = await fetch("http://127.0.0.1:8787/records", { headers: { authorization: `Bearer ${token}` } });
    return response.ok && (await response.json()).length === expected;
  }, before + 1, { timeout: 30_000 });
  const after = await count();
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "107-android-offline-mutation-synced.png") });
  console.log(JSON.stringify({ before, queuedOffline: true, after, synchronized: after === before + 1 }, null, 2));
} finally {
  device("svc", "wifi", "enable");
  device("svc", "data", "enable");
  await browser.close();
}
