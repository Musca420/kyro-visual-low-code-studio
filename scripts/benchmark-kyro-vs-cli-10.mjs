import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, relative, resolve } from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const work = resolve(root, ".kyro", "benchmarks", "evaluation-prompts-10");
const protocol = JSON.parse(await readFile(resolve(root, "docs", "benchmarks", "kyro-vs-codex-cli-10-prompts.json"), "utf8"));
const mode = process.argv[2];
const baseUrl = process.env.KYRO_URL || "http://127.0.0.1:43129";
const promptStart = Math.max(0, Number(process.env.KYRO_PROMPT_START || 0));
const promptLimit = Math.min(protocol.prompts.length, Number(process.env.KYRO_PROMPT_LIMIT || protocol.prompts.length));

const extract = async (archive, target) => {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const zip = await JSZip.loadAsync(await readFile(archive));
  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const output = normalize(join(target, relativePath));
    if (!output.startsWith(`${normalize(target)}\\`)) throw new Error(`Unsafe archive path: ${relativePath}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, await entry.async("nodebuffer"));
  }
};

const treeHash = async (directory) => {
  const hash = createHash("sha256");
  const visit = async (current) => {
    for (const name of (await readdir(current)).sort()) {
      const path = join(current, name);
      const info = await stat(path);
      if (info.isDirectory()) await visit(path);
      else {
        hash.update(relative(directory, path).replaceAll("\\", "/"));
        hash.update(await readFile(path));
      }
    }
  };
  await visit(directory);
  return hash.digest("hex");
};

const jobs = async () => {
  const response = await fetch(`${baseUrl}/api/codex/jobs`);
  if (!response.ok) throw new Error(`Jobs API returned ${response.status}`);
  return response.json();
};

const finalMessage = (output = "") => output.split(/\r?\n/).flatMap((line) => {
  try { const event = JSON.parse(line); return event.item?.type === "agent_message" ? [event.item.text] : []; }
  catch { return []; }
}).at(-1) ?? "";

const setVisualIdentity = async (page, name, label, extras = {}) => {
  await page.getByLabel("Element name").fill(name);
  await page.getByLabel("Text or label").fill(label);
  if (extras.fieldName) await page.getByLabel("Data field name").fill(extras.fieldName);
  if (extras.inputType) await page.getByLabel("Field type").selectOption(extras.inputType);
  if (extras.buttonType) await page.getByLabel("Button behavior").selectOption(extras.buttonType);
  if (extras.inside) await page.getByLabel("Inside").selectOption({ label: extras.inside });
};

async function createBaseline() {
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const browser = await chromium.launch({ headless: false, slowMo: 550 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Project name").fill("Kyro Evaluation Tasks");
    await page.getByLabel("Project goal").fill("Create and manage a small local task list with a visual form, validation, flow, persistence, and export.");
    await page.getByRole("button", { name: "Blank project Start with a clean canvas" }).click();
    await page.getByRole("button", { name: "Add page", exact: true }).click();
    await page.getByLabel("Screen name").fill("Dashboard");
    await page.getByLabel("Screen route").fill("/");
    await page.getByRole("button", { name: "Create screen" }).click();
    const palette = page.locator(".palette");
    const add = async (type) => palette.locator("button").filter({ hasText: new RegExp(`${type}$`, "i") }).first().click();

    await add("title");
    await setVisualIdentity(page, "Dashboard heading", "Tasks");
    await add("form");
    await setVisualIdentity(page, "Task form card", "Create a task");
    await add("input");
    await setVisualIdentity(page, "Title field", "Task title", { fieldName: "text", inside: "Task form card" });
    await add("button");
    await setVisualIdentity(page, "Save button", "Save", { buttonType: "submit", inside: "Task form card" });
    await add("list");
    await setVisualIdentity(page, "Task list", "Tasks");
    await add("card");
    await setVisualIdentity(page, "Task detail card", "Task detail");
    await add("text");
    await setVisualIdentity(page, "Task detail placeholder", "Select a task to view its details.", { inside: "Task detail card" });

    await page.getByRole("button", { name: "Data", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("tasks");
    await page.getByLabel("Collection", { exact: true }).fill("tasks");
    await page.getByRole("button", { name: "Create IndexedDB source" }).click();
    await page.locator(".source-card").filter({ hasText: "tasks" }).click();

    await page.getByRole("button", { name: /^Flow/ }).click();
    await page.getByRole("button", { name: "Create data flow" }).click();
    const steps = page.getByRole("navigation", { name: "Flow steps" });
    await steps.getByRole("button", { name: "Button click", exact: true }).click();
    await page.getByLabel("Event type").selectOption("submit");
    await page.getByLabel("Connected element").selectOption({ label: "Task form card · form" });
    await steps.getByRole("button", { name: "Read input", exact: true }).click();
    await page.getByRole("button", { name: "Delete step" }).click();
    await steps.getByRole("button", { name: "Not empty", exact: true }).click();
    await page.getByLabel("Validation field").fill("text");
    await page.getByLabel("Validation rule").selectOption("required");
    await page.getByLabel("Validation message").fill("Enter a task title");
    await steps.getByRole("button", { name: "Button click", exact: true }).click();
    await page.getByLabel("Next step").selectOption({ label: "Not empty" });

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const preview = page.frameLocator('iframe[title="Preview isolata"]');
    await preview.getByRole("button", { name: "Save" }).waitFor();
    await page.screenshot({ path: resolve(work, "00-baseline-editor.png"), fullPage: true });
    await preview.locator("body").screenshot({ path: resolve(work, "00-baseline-preview.png") });

    const projectDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    await (await projectDownload).saveAs(resolve(work, "baseline-project.json"));
    const appDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export app" }).click();
    const archive = resolve(work, "baseline-app.zip");
    await (await appDownload).saveAs(archive);
    await extract(archive, resolve(work, "baseline-app"));
    for (const copy of ["cli-copy", "kyro-copy"]) {
      await cp(resolve(work, "baseline-app"), resolve(work, copy), { recursive: true });
    }
    const hashes = Object.fromEntries(await Promise.all(["baseline-app", "cli-copy", "kyro-copy"].map(async (name) => [name, await treeHash(resolve(work, name))])));
    if (new Set(Object.values(hashes)).size !== 1) throw new Error(`Initial copies differ: ${JSON.stringify(hashes)}`);
    await writeFile(resolve(work, "baseline-manifest.json"), `${JSON.stringify({ createdIn: "Kyro visual editor", projectFile: "baseline-project.json", copies: hashes, consoleErrors }, null, 2)}\n`);
    if (consoleErrors.length) throw new Error(`Baseline browser errors: ${consoleErrors.join(" | ")}`);
    console.log(JSON.stringify({ work, hashes }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

const resolveComponentName = (item) => item.selection.kind === "component" ? item.selection.name : item.selection.fallbackComponent;

async function runKyro() {
  const browser = await chromium.launch({ headless: false, slowMo: 350 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(240_000);
  const previous = promptStart && await readFile(resolve(work, "kyro-results.partial.json"), "utf8").then(JSON.parse).catch(() => ({ results: [] }));
  const results = previous?.results?.slice(0, promptStart) ?? [];
  const consoleErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Project file to import").setInputFiles(resolve(work, promptStart ? `checkpoint-${String(promptStart).padStart(2, "0")}.json` : "baseline-project.json"));
    await page.getByRole("button", { name: "Kyro Evaluation Tasks" }).click();
    for (const [offset, item] of protocol.prompts.slice(promptStart, promptLimit).entries()) {
      const index = promptStart + offset;
      console.log(`Kyro ${index + 1}/10 — ${item.id}`);
      await page.getByRole("button", { name: "Design", exact: true }).click();
      const targetName = resolveComponentName(item);
      const layer = page.locator(".layers [role=treeitem] > button").filter({ hasText: targetName }).first();
      await layer.scrollIntoViewIfNeeded();
      await layer.click();
      const selected = page.locator(".canvas-component.selected").first();
      const componentId = await selected.getAttribute("data-component-id");
      await selected.click({ button: "right" });
      await page.getByRole("menuitem", { name: /Ask Codex/ }).click();
      const panel = page.getByRole("region", { name: "Codex assistant" });
      await panel.getByLabel("Request in plain language").fill(item.prompt);
      const before = new Set((await jobs()).map((job) => job.id));
      const started = performance.now();
      await panel.getByRole("button", { name: "Analyze request" }).click();
      const approval = panel.locator(".approval-card");
      let planUi = "";
      try {
        await approval.waitFor({ timeout: 210_000 });
        planUi = await approval.innerText();
      } catch {
        planUi = await panel.innerText();
      }
      const approve = panel.getByRole("button", { name: /Approve and apply|Approve global draft/ });
      const done = panel.getByRole("button", { name: "Done", exact: true });
      let applied = false;
      const externalApply = (await jobs()).some((job) => !before.has(job.id) && job.mode === "apply");
      if (externalApply) {
        applied = true;
      } else if (await approve.count()) {
        try {
          await approve.click({ timeout: 5_000 });
          applied = true;
        } catch {
          applied = (await jobs()).some((job) => !before.has(job.id) && job.mode === "apply");
          if (!applied) throw new Error("The approval control disappeared without creating an apply job");
        }
      } else if (await done.count()) {
        await done.click();
      }
      let created = [];
      for (let attempt = 0; attempt < 960; attempt += 1) {
        created = (await jobs()).filter((job) => !before.has(job.id) && ["plan", "apply"].includes(job.mode));
        const planFinished = created.some((job) => job.mode === "plan" && job.status !== "running");
        const applyFinished = !applied || created.some((job) => job.mode === "apply" && job.status !== "running");
        if (planFinished && applyFinished) break;
        await page.waitForTimeout(250);
      }
      const plan = created.find((job) => job.mode === "plan");
      const apply = created.find((job) => job.mode === "apply");
      const actionElapsedMs = Math.round(performance.now() - started);
      const success = plan?.status === "completed" && (!applied || apply?.status === "completed");
      const close = panel.getByRole("button", { name: "Close Codex panel" });
      if (await close.count()) await close.click();

      const verifyStarted = performance.now();
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      const preview = page.frameLocator('iframe[title="Preview isolata"]');
      await preview.locator("body").waitFor();
      const previewPath = resolve(work, `kyro-${String(index + 1).padStart(2, "0")}-${item.id}-preview.png`);
      await preview.locator("body").screenshot({ path: previewPath });
      await page.screenshot({ path: resolve(work, `kyro-${String(index + 1).padStart(2, "0")}-${item.id}.png`), fullPage: true });
      const bodyMetrics = await preview.locator("body").evaluate((body) => ({
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        text: body.innerText.slice(0, 4000),
      }));
      results.push({
        id: item.id,
        prompt: item.prompt,
        selectedTarget: targetName,
        requestedSelection: item.selection,
        componentId,
        actionElapsedMs,
        verificationElapsedMs: Math.round(performance.now() - verifyStarted),
        success,
        planStatus: plan?.status ?? "missing",
        applyStatus: applied ? (apply?.status ?? "missing") : "not-required",
        contextBytes: plan?.contextBytes ?? 0,
        usage: {
          inputTokens: Number(plan?.usage?.inputTokens ?? 0) + Number(apply?.usage?.inputTokens ?? 0),
          cachedInputTokens: Number(plan?.usage?.cachedInputTokens ?? 0) + Number(apply?.usage?.cachedInputTokens ?? 0),
          outputTokens: Number(plan?.usage?.outputTokens ?? 0) + Number(apply?.usage?.outputTokens ?? 0),
          totalTokens: Number(plan?.usage?.totalTokens ?? 0) + Number(apply?.usage?.totalTokens ?? 0),
        },
        planJobId: plan?.id,
        applyJobId: apply?.id,
        transactionId: apply?.transactionId,
        planUi,
        plan: finalMessage(plan?.output),
        result: finalMessage(apply?.output),
        errors: [plan?.errors, apply?.errors].filter(Boolean),
        preview: { ...bodyMetrics, screenshot: previewPath },
      });
      await writeFile(resolve(work, "kyro-results.partial.json"), `${JSON.stringify({ protocol: protocol.title, results, consoleErrors }, null, 2)}\n`);
      if (!success) throw new Error(`Kyro failed ${item.id}: ${[plan?.errors, apply?.errors].filter(Boolean).join(" | ") || "invalid plan"}`);
      const checkpoint = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export JSON" }).click();
      await (await checkpoint).saveAs(resolve(work, `checkpoint-${String(index + 1).padStart(2, "0")}.json`));
      console.log(`Kyro ${item.id}: ${success ? "completed" : "failed"} in ${actionElapsedMs} ms`);
    }
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export app" }).click();
    const archive = resolve(work, "kyro-final.zip");
    await (await download).saveAs(archive);
    await extract(archive, resolve(work, "kyro-final"));
    await writeFile(resolve(work, "kyro-results.json"), `${JSON.stringify({ protocol: protocol.title, results, consoleErrors }, null, 2)}\n`);
  } finally {
    await context.close();
    await browser.close();
  }
}

if (mode === "baseline") await createBaseline();
else if (mode === "kyro") await runKyro();
else throw new Error("Usage: node scripts/benchmark-kyro-vs-cli-10.mjs <baseline|kyro>");
