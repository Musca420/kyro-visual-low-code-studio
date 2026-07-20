import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-final-export-profile-3"), {
  headless: false,
  slowMo: 160,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1440, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const errors = [], failed = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("favicon")) failed.push([response.status(), response.url()]); });

try {
  await page.goto("http://127.0.0.1:43230/", { waitUntil: "domcontentloaded" });
  const gate = page.locator("#auth-gate");
  let account = "existing session";
  if (await gate.isVisible()) {
    await gate.getByLabel("Email", { exact: true }).fill("judge@kyro.local");
    await gate.getByLabel("Password", { exact: true }).fill("KyroJudge2026!");
    await gate.getByRole("button", { name: "Create the first account" }).click();
    await page.waitForTimeout(400);
    account = await gate.isVisible() ? "existing account" : "created";
    if (await gate.isVisible()) await gate.getByRole("button", { name: "Sign in" }).click();
  }
  await page.getByRole("navigation", { name: "Pages" }).waitFor();
  await page.getByText("More", { exact: true }).click();
  await page.locator('a[href="#/bookings/:id"]').click();
  await page.getByText("€145 protected", { exact: true }).click();
  await page.getByText("Sandbox payment completed", { exact: true }).waitFor();
  await page.getByText("Elena Bianchi · Field team", { exact: true }).click();
  await page.getByText("Assigned team completed", { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  if (!(await page.getByRole("navigation", { name: "Pages" }).isVisible())) throw new Error("Signed session did not persist after reload");
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 60) }));
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "55-final-web-export-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 }); await page.screenshot({ path: resolve("artifacts", "nexusfield", "56-final-web-export-tablet.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: resolve("artifacts", "nexusfield", "57-final-web-export-mobile.png"), fullPage: true });
  const expectedSecurityResponse = ([status, url]) => (status === 409 && url.endsWith("/auth/register")) || (status === 401 && url.endsWith("/auth/session"));
  const blockingErrors = errors.filter((message) => !message.includes("409 (Conflict)") && !message.includes("401 (Unauthorized)"));
  const blockingResponses = failed.filter((response) => !expectedSecurityResponse(response));
  await context.setOffline(true); await page.reload({ waitUntil: "domcontentloaded" });
  const offline = await page.title(); await page.screenshot({ path: resolve("artifacts", "nexusfield", "58-final-web-export-offline.png"), fullPage: true }); await context.setOffline(false);
  console.log(JSON.stringify({ account, login: "passed", protectedMutation: "passed", sharedBackendMutation: "passed", persistedSession: true, focus, offline, blockingErrors, blockingResponses, expectedOfflineEvents: errors.length - blockingErrors.length }, null, 2));
  if (blockingErrors.length || blockingResponses.length) throw new Error(`Runtime errors before offline test: ${JSON.stringify({ blockingErrors, blockingResponses })}`);
  await page.waitForTimeout(2500);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-final-web-export.png"), fullPage: true });
  throw error;
} finally {
  await context.tracing.stop({ path: resolve("artifacts", "nexusfield", "NexusField-Web-final-trace.zip") });
  await context.close();
}
