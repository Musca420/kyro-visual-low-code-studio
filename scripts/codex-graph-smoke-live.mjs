import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve("artifacts", "codex-graph-smoke");
const baseUrl = process.env.KYRO_URL || "http://127.0.0.1:5173";
await mkdir(artifacts, { recursive: true });
const browserProfile = process.env.KYRO_BROWSER_PROFILE ? resolve(process.env.KYRO_BROWSER_PROFILE) : resolve(artifacts, "browser-profile");
const context = await chromium.launchPersistentContext(browserProfile, {
  headless: false,
  slowMo: 180,
  viewport: { width: 1440, height: 900 },
});
const page = context.pages()[0] ?? await context.newPage();
page.setDefaultTimeout(45_000);
const evidence = { startedAt: new Date().toISOString(), planMs: 0, applyMs: 0, undoVerified: false };

try {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("Project name").fill(`Codex graph smoke ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "button" }).click();

  const component = page.getByTestId("component-button");
  await component.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(
    "Change only this selected button label to Continue securely. Preserve its stable ID and all existing styles. Verify the result in preview.",
  );

  const planStarted = Date.now();
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  await page.waitForTimeout(600);
  if (await assistant.getByText("Codex returned no text.", { exact: true }).count())
    throw new Error("Running Codex job displayed the empty-response fallback");
  const approve = assistant.getByRole("button", { name: "Approve and apply" });
  await approve.waitFor({ timeout: 180_000 });
  evidence.planMs = Date.now() - planStarted;
  await page.screenshot({ path: resolve(artifacts, "01-approved-plan.png"), fullPage: true });

  const applyStarted = Date.now();
  await approve.click();
  const analyze = assistant.getByRole("button", { name: "Analyze request" });
  await analyze.waitFor({ state: "visible", timeout: 180_000 });
  while (await analyze.isDisabled()) await page.waitForTimeout(250);
  evidence.applyMs = Date.now() - applyStarted;
  const latestJob = await page.evaluate(async () => (await fetch("/api/codex/jobs").then((response) => response.json()))[0]);
  if (latestJob?.status !== "completed")
    throw new Error(`Codex apply job ${latestJob?.status ?? "missing"}: ${latestJob?.errors ?? "unknown error"}`);
  await page.screenshot({ path: resolve(artifacts, "02-applied-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "Design", exact: true }).click();
  if (!(await component.innerText()).includes("Continue securely"))
    throw new Error(`Codex transaction did not update the selected component: ${await component.innerText()}`);

  await assistant.getByRole("button", { name: "Undo change" }).click();
  await page.waitForTimeout(1_500);
  if ((await component.innerText()).includes("Continue securely"))
    throw new Error("The graph transaction was not undone");
  evidence.undoVerified = true;
  await page.screenshot({ path: resolve(artifacts, "03-undone.png"), fullPage: true });
  await writeFile(resolve(artifacts, "evidence.json"), JSON.stringify({ ...evidence, finishedAt: new Date().toISOString() }, null, 2));
  await page.waitForTimeout(3_000);
} catch (error) {
  await page.screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true });
  await writeFile(resolve(artifacts, "evidence.json"), JSON.stringify({ ...evidence, error: error instanceof Error ? error.message : String(error) }, null, 2));
  throw error;
} finally {
  await context.close();
}
