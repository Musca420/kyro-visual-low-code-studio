import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import JSZip from "jszip";
import packageJson from "../package.json" with { type: "json" };

const evidence = [
  "package.json",
  "CHANGELOG.md",
  "ROLLBACK.md",
  "docs/20-KYRO_CHECKLIST.md",
  "docs/21-ARCHITECTURE_REVIEW.md",
  "docs/22-IMPLEMENTATION_PLAN.md",
  "docs/benchmarks/2026-07-21-live.json",
  "docs/images/kyro-global-capability-draft.png",
  "docs/images/kyro-live-codex-plan.png",
  "e2e/demo-a.spec.ts",
  "e2e/demo-b.spec.ts",
  "e2e/demo-c.spec.ts",
  "artifacts/demo-a-existing-project.zip",
  "artifacts/demo-a-standalone.png",
  "artifacts/demo-b-global-web-app.zip",
  "artifacts/demo-b-global-standalone.png",
  "artifacts/demo-c-four-page-app.zip",
  "artifacts/demo-c-mobile-runtime.png",
  "artifacts/demo-c-standalone-runtime.png",
].sort();

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fixedDate = new Date("2026-07-21T00:00:00.000Z");
const files = [];
for (const path of evidence) {
  const data = await readFile(resolve(path));
  files.push({ path, bytes: data.length, sha256: sha256(data), data });
}

const manifest = {
  schemaVersion: 1,
  product: "Kyro",
  version: packageJson.version,
  releaseDate: "2026-07-21",
  files: files.map(({ path, bytes, sha256: hash }) => ({ path, bytes, sha256: hash })),
};
const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const zip = new JSZip();
zip.file("manifest.json", manifestData, { date: fixedDate });
for (const file of files) zip.file(file.path, file.data, { date: fixedDate });
for (const entry of Object.values(zip.files)) entry.date = fixedDate;
const archive = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
  platform: "UNIX",
});

await mkdir(resolve("release"), { recursive: true });
const archivePath = resolve("release", `kyro-${packageJson.version}-evidence.zip`);
await writeFile(resolve("release", "evidence-manifest.json"), manifestData);
await writeFile(archivePath, archive);
console.log(JSON.stringify({ archive: basename(archivePath), bytes: archive.length, sha256: sha256(archive), files: files.length }));
