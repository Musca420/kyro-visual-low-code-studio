import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-offline-sync-profile"), {
  headless: false,
  slowMo: 120,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1440, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
const errors = [];
page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

try {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.goto("http://127.0.0.1:43231/", { waitUntil: "domcontentloaded" });
  if (await page.getByRole("heading", { name: "Sign in" }).isVisible()) {
    const gate = page.locator("#auth-gate");
    await gate.getByLabel("Email", { exact: true }).fill("offline@kyro.local");
    await gate.getByLabel("Password", { exact: true }).fill("KyroOffline2026");
    await gate.getByRole("button", { name: "Create the first account" }).click();
    await page.getByText("NexusField · Dashboard").waitFor();
  }

  const count = () => page.evaluate(async () => {
    const token = localStorage.getItem("frontend-editor-session") || "";
    const response = await fetch("http://127.0.0.1:8787/records", { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Records request failed (${response.status})`);
    return (await response.json()).length;
  });
  const before = await count();
  await page.goto("http://127.0.0.1:43231/#/bookings/offline-test", { waitUntil: "domcontentloaded" });
  await context.setOffline(true);
  await page.getByText("Elena Bianchi · Field team", { exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kyro-offline-mutations") || "[]").length === 1);
  await context.setOffline(false);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kyro-offline-mutations") || "[]").length === 0);
  await page.waitForFunction(async (expected) => {
    const token = localStorage.getItem("frontend-editor-session") || "";
    const response = await fetch("http://127.0.0.1:8787/records", { headers: { authorization: `Bearer ${token}` } });
    return response.ok && (await response.json()).length === expected;
  }, before + 1);
  await page.reload({ waitUntil: "domcontentloaded" });
  const after = await count();
  if (after !== before + 1) throw new Error(`Expected one synchronized record, got ${before} → ${after}`);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "103-web-offline-mutation-synced.png"), fullPage: true });
  console.log(JSON.stringify({ before, queuedOffline: true, after, persistedAfterReload: true, blockingConsoleErrors: errors }, null, 2));
} finally {
  await context.tracing.stop({ path: resolve("artifacts", "nexusfield", "NexusField-Web-offline-sync-trace.zip") }).catch(() => undefined);
  await context.close();
}
