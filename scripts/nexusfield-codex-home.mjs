import { chromium } from "playwright";
import { resolve } from "node:path";

const context = await chromium.launchPersistentContext(resolve("artifacts", "nexusfield-browser-profile"), {
  headless: false,
  slowMo: 240,
  viewport: { width: 1600, height: 900 },
});
const openPages = context.pages();
const page = openPages[0] ?? await context.newPage();
await Promise.all(openPages.slice(1).map((extra) => extra.close()));
page.setDefaultTimeout(45_000);
const jobs = () => fetch("http://127.0.0.1:43127/api/codex/jobs").then((response) => response.json());
const waitForNewJob = async (known) => { for (let attempt = 0; attempt < 120; attempt += 1) { const job = (await jobs()).find((item) => !known.includes(item.id)); if (job) return job; await new Promise((wait) => setTimeout(wait, 250)); } throw new Error("Codex job was not created"); };
const waitForJob = async (id) => { for (let attempt = 0; attempt < 1_200; attempt += 1) { const job = (await jobs()).find((item) => item.id === id); if (job?.status !== "running") return job; await new Promise((wait) => setTimeout(wait, 250)); } throw new Error(`Codex job ${id} timed out`); };
try {
  await page.goto("http://127.0.0.1:43127/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  if (!(await page.getByRole("button", { name: "Design" }).count()))
    await page.getByRole("button", { name: /NexusField Mobile/ }).click();
  await page.waitForTimeout(1200);
  const home = page.getByRole("button", { name: /Home\// }).first();
  if (await home.count()) await home.click();
  const matchingHeader = page.getByRole("button", { name: /Header/ }).last();
  const header = await matchingHeader.count() ? matchingHeader : page.locator(".layers button").first();
  await header.click();
  const selectedId = await page.locator("[data-component-id].selected").first().getAttribute("data-component-id");
  await page.locator(`[data-component-id="${selectedId}"]`).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
  const assistant = page.getByRole("region", { name: "Codex assistant" });
  await assistant.getByLabel("Request in plain language").fill(
    "Transform the current Home page into the polished mobile customer dashboard for NexusField, a local-first field-service marketplace. Keep every element native and visually editable. Create an accessible compact header with greeting, location and notification action; a prominent service search input; quick category cards; a nearby professionals/services section with rating, price and favorite controls; a pending quote or booking card with status; a map preview; a primary Book a service action; and a clear five-item bottom navigation for Home, Search, Bookings, Messages and Profile. Use an original dark neutral visual system with cyan and coral accents, 48px touch targets, visible focus states, safe spacing, responsive phone and tablet styles, loading/empty/error components, and semantic intent. Do not write generated code and do not create fake data yet.",
  );
  const started = Date.now();
  const before = (await jobs()).map((job) => job.id);
  await assistant.getByRole("button", { name: "Analyze request" }).click();
  const startedPlan = await waitForNewJob(before);
  const planJob = await waitForJob(startedPlan.id);
  if (planJob.status !== "completed") throw new Error(planJob.errors || "Home plan failed");
  await assistant.getByRole("button", { name: "Approve and apply" }).waitFor({ timeout: 180_000 });
  console.log(`Plan ready in ${Math.round((Date.now() - started) / 1000)}s`);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "04-codex-home-plan.png"), fullPage: true });
  await assistant.getByRole("button", { name: "Approve and apply" }).click();
  const startedApply = await waitForNewJob([...before, planJob.id]);
  const applyJob = await waitForJob(startedApply.id);
  if (applyJob.status !== "completed") throw new Error(applyJob.errors || "Home apply failed");
  const live = await fetch("http://127.0.0.1:43127/api/live/status").then((response) => response.json());
  const rootStyle = live.componentTree?.[0]?.styles?.desktop;
  const storedStyle = await page.evaluate(async ({ projectId, pageId }) => new Promise((resolveStored, rejectStored) => {
    const open = indexedDB.open("frontend-editor", 4);
    open.onerror = () => rejectStored(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction("projects", "readonly").objectStore("projects").get(projectId);
      request.onerror = () => rejectStored(request.error);
      request.onsuccess = () => { resolveStored(request.result?.pages?.find((item) => item.id === pageId)?.components?.[0]?.styles?.desktop); db.close(); };
    };
  }), { projectId: live.projectId, pageId: live.pageId });
  console.log(JSON.stringify({ transactionId: applyJob.transactionId, rootStyle, storedStyle }, null, 2));
  await page.waitForTimeout(1200);
  await assistant.getByRole("button", { name: "Close Codex panel" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "05-home-after-codex.png"), fullPage: true });
  console.log(JSON.stringify({
    layers: (await page.locator(".layers button").allTextContents()).slice(-30),
    errors: await page.getByRole("alert").allTextContents(),
  }, null, 2));
  await page.waitForTimeout(5000);
} catch (error) {
  await page.screenshot({ path: resolve("artifacts", "nexusfield", "failure-codex-home.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
}
