import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 150,
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: resolve("artifacts", "nexusfield", "raw-video"), size: { width: 1600, height: 900 } },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(60_000);
const roles = ["customer", "professional", "employee", "manager"];

async function openProject(name) {
  if (await page.getByRole("button", { name: "Close project and return to the dashboard" }).count())
    await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByRole("button", { name: "Design" }).waitFor();
}

async function configure(name, target) {
  await openProject(name);
  await page.getByRole("button", { name: "Data" }).click();
  if (!(await page.locator(".source-card").filter({ hasText: "Shared domain records" }).count())) {
    const form = page.locator(".data-layout form.settings-card");
    await form.getByText("Generate the backend too", { exact: true }).click();
    await form.getByLabel("Name", { exact: true }).fill("Shared domain records");
    await form.getByLabel("Collection", { exact: true }).fill("sharedRecords");
    await form.getByRole("button", { name: "Configure generated backend" }).click();
    await page.locator(".source-card").filter({ hasText: "Shared domain records" }).waitFor();
  }
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: target === "android" ? /^Android/ : /^PWA/ }).click();
  await page.getByLabel("Who can sign in?").selectOption("generated");
  for (const role of roles) {
    if (await page.getByText(role, { exact: true }).count()) continue;
    await page.getByLabel("Add a role").fill(role);
    await page.getByRole("button", { name: "Add role" }).click();
  }
  const offline = page.getByLabel("Keep an offline copy whenever possible");
  if (!(await offline.isChecked())) await offline.check();
  await page.getByLabel("Automatic updates").selectOption("sse");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", `48-${target}-access-offline.png`), fullPage: true });
  await page.getByRole("button", { name: "Close project and return to the dashboard" }).click();
  await page.getByRole("button", { name: new RegExp(name, "i") }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  const checked = await Promise.all(roles.map((role) => page.getByText(role, { exact: true }).isVisible()));
  if (!checked.every(Boolean) || !(await page.getByLabel("Keep an offline copy whenever possible").isChecked()))
    throw new Error(`${name} lost its access or offline configuration after reopen`);
}

try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  await configure("NexusField Web", "pwa");
  await configure("NexusField Mobile", "android");
  console.log(JSON.stringify({ projects: 2, roles, persistence: true, generatedBackend: true, offline: true }));
  await page.waitForTimeout(3000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-platform-config.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
