import { copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const run = resolve(root, ".kyro", "benchmarks", "evaluation-prompts-10");
const docs = resolve(root, "docs", "benchmarks");
const images = resolve(root, "docs", "images");
const kyro = JSON.parse(await readFile(resolve(run, "kyro-results.json"), "utf8")).results;
const cli = JSON.parse((await readFile(resolve(run, "cli-results.json"), "utf8")).replace(/^\uFEFF/, "")).results;

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    total,
    mean: Math.round(total / sorted.length),
    median: sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2),
    min: sorted[0],
    max: sorted.at(-1),
  };
};

const cliRefused = cli.every((item) => /(?:can(?:no|'?t)|couldn|'?m blocked).{0,180}(?:Kyro|live|graph|tools)/is.test(item.result));
const summary = {
  schemaVersion: 1,
  recordedAt: "2026-07-21",
  protocol: "10 cumulative prompts on byte-identical exported projects",
  environment: {
    operatingSystem: "Windows",
    modelSelection: "authenticated Codex default model; low reasoning effort on planning turns",
    kyroPath: "Ask Codex with selected stable IDs, compact graph context, typed operation registry, approval, transaction, Preview verification",
    cliPath: "Codex CLI from PowerShell in the exported project folder, ephemeral fresh session per prompt, no Kyro Live Bridge",
    promptOrder: "identical and cumulative",
  },
  startingTree: {
    baselineSha256: "8f0507d1a20632250564560f7d878f1346777dbeadb6a4538b5170c43e131065",
    kyroCopySha256: "8f0507d1a20632250564560f7d878f1346777dbeadb6a4538b5170c43e131065",
    cliCopySha256: "8f0507d1a20632250564560f7d878f1346777dbeadb6a4538b5170c43e131065",
  },
  outcome: {
    kyroAcceptedPrompts: kyro.filter((item) => item.success).length,
    cliAcceptedPrompts: cliRefused ? 0 : null,
    cliExitZeroTurns: cli.filter((item) => item.success).length,
    cliOutputTreeUnchangedSha256: "8f0507d1a20632250564560f7d878f1346777dbeadb6a4538b5170c43e131065",
    kyroOutputTreeSha256: "111059bc48040717e661e848cf54b2d57d3d37a4f21dab889135a928ad9521b0",
    kyroIndependentVisualVerification: {
      validationAndFocus: true,
      optionalDateRendering: true,
      filtersAndEmptyState: true,
      mobileOverflow: false,
      persistedAfterReload: true,
      exportInstalledAndBuilt: true,
      exportRuntimeVerified: true,
      consoleAndRuntimeErrors: 0,
    },
  },
  aggregate: {
    kyro: {
      elapsedMs: stats(kyro.map((item) => item.actionElapsedMs)),
      totalTokens: stats(kyro.map((item) => item.usage.totalTokens)),
      contextBytes: stats(kyro.map((item) => item.contextBytes)),
    },
    cli: {
      elapsedMs: stats(cli.map((item) => item.elapsedMs)),
      totalTokens: stats(cli.map((item) => item.usage.totalTokens)),
      commandExecutions: stats(cli.map((item) => item.commandExecutions)),
    },
  },
  prompts: kyro.map((item, index) => ({
    id: item.id,
    prompt: item.prompt,
    kyro: { accepted: item.success, elapsedMs: item.actionElapsedMs, totalTokens: item.usage.totalTokens, contextBytes: item.contextBytes },
    cli: { accepted: false, exitCode: cli[index].exitCode, elapsedMs: cli[index].elapsedMs, totalTokens: cli[index].usage.totalTokens, commandExecutions: cli[index].commandExecutions, result: cli[index].result },
  })),
  interpretation: [
    "Codex CLI was faster in wall-clock time in this run, but it applied none of the requested live-graph changes.",
    "Kyro completed all ten cumulative tasks and passed an independent headed Preview/export workflow.",
    "Token totals were similar overall; this run does not support a token-reduction claim.",
    "The prompts intentionally depend on live selection and graph context. This measures Kyro's contextual execution path, not general coding ability.",
    "Exit code zero is not counted as functional success when the project tree is unchanged and the agent reports that it could not act.",
  ],
};

await writeFile(resolve(docs, "2026-07-21-kyro-vs-codex-cli-10-results.json"), `${JSON.stringify(summary, null, 2)}\n`);
await copyFile(resolve(run, "kyro-results.json"), resolve(docs, "2026-07-21-kyro-10-raw.json"));
await copyFile(resolve(run, "cli-results.json"), resolve(docs, "2026-07-21-codex-cli-10-raw.json"));
await copyFile(resolve(run, "verified-desktop.png"), resolve(images, "kyro-benchmark-10-desktop.png"));
await copyFile(resolve(run, "verified-mobile.png"), resolve(images, "kyro-benchmark-10-mobile.png"));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="480" viewBox="0 0 1000 480" role="img" aria-labelledby="title desc">
<title id="title">Kyro and Codex CLI ten-prompt benchmark</title><desc id="desc">Kyro accepted ten of ten live graph prompts. Codex CLI accepted zero. CLI was faster, while total token use was similar.</desc>
<rect width="1000" height="480" rx="28" fill="#101318"/><text x="56" y="62" fill="#f4f7fb" font-family="Inter,Arial" font-size="28" font-weight="700">10 cumulative prompts, identical starting project</text>
<text x="56" y="96" fill="#9aa5b1" font-family="Inter,Arial" font-size="16">Functional acceptance first; latency and tokens shown without hiding failed outcomes.</text>
<text x="56" y="158" fill="#f4f7fb" font-family="Inter,Arial" font-size="18">Accepted prompts</text><rect x="240" y="134" width="600" height="28" rx="8" fill="#1c232b"/><rect x="240" y="134" width="600" height="28" rx="8" fill="#22d3c5"/><text x="856" y="156" fill="#22d3c5" font-family="Inter,Arial" font-size="18" font-weight="700">Kyro 10/10</text><text x="240" y="190" fill="#ff8b6b" font-family="Inter,Arial" font-size="18" font-weight="700">Codex CLI 0/10 (10 exit-zero refusals)</text>
<text x="56" y="258" fill="#f4f7fb" font-family="Inter,Arial" font-size="18">Median wall time</text><rect x="240" y="234" width="448" height="24" rx="7" fill="#22d3c5"/><text x="704" y="253" fill="#f4f7fb" font-family="Inter,Arial" font-size="16">Kyro 44.8 s</text><rect x="240" y="273" width="270" height="24" rx="7" fill="#ff8b6b"/><text x="526" y="292" fill="#f4f7fb" font-family="Inter,Arial" font-size="16">CLI 27.0 s</text>
<text x="56" y="360" fill="#f4f7fb" font-family="Inter,Arial" font-size="18">Total tokens</text><rect x="240" y="336" width="549" height="24" rx="7" fill="#22d3c5"/><text x="805" y="355" fill="#f4f7fb" font-family="Inter,Arial" font-size="16">Kyro 784k</text><rect x="240" y="375" width="535" height="24" rx="7" fill="#ff8b6b"/><text x="791" y="394" fill="#f4f7fb" font-family="Inter,Arial" font-size="16">CLI 764k</text>
<text x="56" y="446" fill="#9aa5b1" font-family="Inter,Arial" font-size="14">Measured 21 July 2026 on one Windows workstation. Raw records, prompts, method, and limitations are published with the repository.</text></svg>`;
await writeFile(resolve(images, "kyro-vs-codex-cli-10.svg"), `${svg}\n`);
console.log(JSON.stringify(summary.aggregate, null, 2));
