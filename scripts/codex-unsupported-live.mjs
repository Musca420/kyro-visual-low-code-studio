import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifacts = resolve("artifacts", "codex-unsupported");
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
const jobs = () => fetch(`${baseUrl}/api/codex/jobs`).then((response) => response.json());
const waitForNewJob = async (known) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const job = (await jobs()).find((item) => !known.includes(item.id));
    if (job) return job;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Kyro did not create the expected Codex job");
};
const waitForJob = async (id) => {
  for (let attempt = 0; attempt < 720; attempt += 1) {
    const job = (await jobs()).find((item) => item.id === id);
    if (job?.status !== "running") return job;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Codex job ${id} did not finish`);
};

try {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByLabel("Project name").fill(`Unsupported capability ${Date.now()}`);
  await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await page.getByRole("button", { name: "Create screen" }).click();
  await page.locator(".palette button").filter({ hasText: "button" }).click();
  await page.getByTestId("component-button").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(
    "When this button is clicked, generate a digitally signed PDF invoice with a QR code and send it through SMTP. If Kyro lacks this capability, derive a safe reusable capability rather than hard-coding this project.",
  );
  const beforeJobs = (await jobs()).map((job) => job.id);
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  const startedPlan = await waitForNewJob(beforeJobs);
  const planJob = await waitForJob(startedPlan.id);
  if (planJob.status !== "completed") throw new Error(planJob.errors || "Capability plan failed");
  const approve = assistant.getByRole("button", { name: "Approve global draft" });
  await approve.waitFor({ timeout: 180_000 });
  await page.screenshot({ path: resolve(artifacts, "01-global-proposal.png"), fullPage: true });
  await approve.click();
  const startedApply = await waitForNewJob([...beforeJobs, planJob.id]);
  const applyJob = await waitForJob(startedApply.id);
  if (applyJob.status !== "completed") throw new Error(applyJob.errors || "Capability registration failed");
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  await page.getByRole("button", { name: /^Extensions/ }).click();
  const learnedCard = page.locator(".plugin-card").filter({ hasText: "State: draft" }).first();
  await learnedCard.waitFor({ timeout: 20_000 });
  await page.screenshot({ path: resolve(artifacts, "02-global-registry.png"), fullPage: true });
  const registry = await learnedCard.allTextContents();
  await writeFile(resolve(artifacts, "evidence.json"), JSON.stringify({ plan: { status: planJob.status, errors: planJob.errors, contextBytes: planJob.contextBytes, usage: planJob.usage, output: planJob.output }, apply: { status: applyJob.status, errors: applyJob.errors, usage: applyJob.usage, output: applyJob.output }, registry }, null, 2));
  await page.waitForTimeout(3_000);
} finally {
  await context.close();
}
