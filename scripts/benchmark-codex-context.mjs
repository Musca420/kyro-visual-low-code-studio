import { spawn } from "node:child_process";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const prompts = {
  button: "Change only this selected button label to Continue securely. Preserve its stable ID and all existing styles. Verify the result in preview.",
  capability: "When this button is clicked, generate a digitally signed PDF invoice with a QR code and send it through SMTP. If Kyro lacks this capability, derive a safe reusable capability rather than hard-coding this project.",
};

const pathName = process.argv[2];
const task = process.argv[3];
const trial = Number(process.argv[4]);
if (!['kyro', 'cli'].includes(pathName) || !prompts[task] || !Number.isInteger(trial) || trial < 1)
  throw new Error("Usage: node scripts/benchmark-codex-context.mjs <kyro|cli> <button|capability> <trial>");

const outputDir = resolve('.kyro', 'benchmarks', 'context-paths');
await mkdir(outputDir, { recursive: true });
const outputPath = resolve(outputDir, `${pathName}-${task}-${trial}.json`);
const startedAt = new Date().toISOString();

const parseEvents = (output) => output.split(/\r?\n/).flatMap((line) => {
  try { return [JSON.parse(line)]; } catch { return []; }
});
const usageFrom = (events) => {
  const usage = events.findLast((event) => event.type === 'turn.completed')?.usage ?? {};
  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    cachedInputTokens: Number(usage.cached_input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningOutputTokens: Number(usage.reasoning_output_tokens ?? 0),
    totalTokens: Number(usage.input_tokens ?? 0) + Number(usage.output_tokens ?? 0),
  };
};

async function runCli() {
  const codexJs = resolve(process.env.APPDATA ?? '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  await access(codexJs);
  const skillRoot = resolve('.agents', 'skills');
  const skillPaths = (await readdir(skillRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(skillRoot, entry.name, 'SKILL.md').replaceAll('\\', '/'));
  const disabledSkills = `[${skillPaths.map((path) => `{ path=${JSON.stringify(path)}, enabled=false }`).join(',')}]`;
  const args = [codexJs, 'exec', '--ignore-user-config', '--ephemeral', '--json', '--sandbox', 'read-only', '--model', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="low"', '-c', `skills.config=${disabledSkills}`, prompts[task]];
  const started = performance.now();
  const output = await new Promise((resolveOutput, reject) => {
    const child = spawn(process.execPath, args, { cwd: resolve('.'), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolveOutput(stdout) : reject(new Error(stderr || `Codex exited ${code}`)));
  });
  const events = parseEvents(output);
  const commands = events.flatMap((event) => event.item?.type === 'command_execution' && event.item.status === 'completed' ? [event.item.command] : []);
  return {
    elapsedMs: Math.round(performance.now() - started),
    baseline: 'same repository with Kyro skills disabled and no Live Bridge',
    disabledSkillCount: skillPaths.length,
    usage: usageFrom(events),
    commands,
    finalMessage: events.flatMap((event) => event.item?.type === 'agent_message' ? [event.item.text] : []).at(-1) ?? '',
  };
}

async function runKyro() {
  const baseUrl = process.env.KYRO_URL || 'http://127.0.0.1:43127';
  const jobs = () => fetch(`${baseUrl}/api/codex/jobs`).then((response) => response.json());
  const before = new Set((await jobs()).map((job) => job.id));
  const profile = resolve('.kyro', 'benchmarks', 'browser-profiles', `${task}-${trial}`);
  const context = await chromium.launchPersistentContext(profile, { headless: false, slowMo: 180, viewport: { width: 1440, height: 900 } });
  const page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(45_000);
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByLabel('Project name').fill(`Benchmark ${task} ${trial}`);
    await page.getByRole('button', { name: 'Blank project Start with a clean canvas' }).click();
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await page.getByRole('button', { name: 'Create screen' }).click();
    await page.locator('.palette button').filter({ hasText: 'button' }).click();
    await page.getByTestId('component-button').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Ask Codex/ }).click();
    const assistant = page.getByRole('region', { name: 'Codex assistant' });
    await assistant.getByLabel('Request in plain language').fill(prompts[task]);
    const started = performance.now();
    await assistant.getByRole('button', { name: 'Analyze request' }).click();
    await assistant.getByRole('button', { name: task === 'button' ? 'Approve and apply' : 'Approve global draft' }).waitFor({ timeout: 180_000 });
    let job;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      job = (await jobs()).find((candidate) => !before.has(candidate.id) && candidate.mode === 'plan');
      if (job?.status === 'completed') break;
      await page.waitForTimeout(250);
    }
    if (!job || job.status !== 'completed') throw new Error(job?.errors || 'Kyro plan job did not complete');
    const screenshot = resolve(outputDir, `${pathName}-${task}-${trial}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      elapsedMs: Math.round(performance.now() - started),
      contextBytes: job.contextBytes,
      usage: job.usage,
      finalMessage: parseEvents(job.output).flatMap((event) => event.item?.type === 'agent_message' ? [event.item.text] : []).at(-1) ?? '',
      screenshot,
    };
  } finally {
    await context.close();
  }
}

const result = {
  schemaVersion: 1,
  path: pathName,
  task,
  trial,
  prompt: prompts[task],
  model: 'gpt-5.6-sol',
  reasoningEffort: 'low',
  mutation: 'none (planning only)',
  startedAt,
  ...await (pathName === 'kyro' ? runKyro() : runCli()),
  finishedAt: new Date().toISOString(),
};
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`\nBENCHMARK_RESULT ${outputPath}`);
