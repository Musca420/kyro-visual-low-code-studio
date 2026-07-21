import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

type EvidenceManifest = {
  schemaVersion: number;
  product: string;
  version: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
};

const root = resolve(import.meta.dirname, "..");
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");

describe("Kyro release", () => {
  it("keeps version, changelog and rollback metadata consistent", async () => {
    const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    const packageLock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
    const changelog = await readFile(resolve(root, "CHANGELOG.md"), "utf8");
    const rollback = await readFile(resolve(root, "ROLLBACK.md"), "utf8");
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageLock.version).toBe(packageJson.version);
    expect(packageLock.packages[""].version).toBe(packageJson.version);
    expect(changelog).toContain(`## [${packageJson.version}]`);
    expect(rollback).toContain("v2.0.0");
    expect(rollback).toContain("npm run release:verify");
  });

  it("verifies every byte in the standalone evidence bundle", async () => {
    const manifest = JSON.parse(await readFile(resolve(root, "release/evidence-manifest.json"), "utf8")) as EvidenceManifest;
    const archive = await readFile(resolve(root, `release/kyro-${manifest.version}-evidence.zip`));
    const zip = await JSZip.loadAsync(archive);
    const bundledManifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    expect(bundledManifest).toEqual(manifest);
    const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    expect(manifest).toMatchObject({ schemaVersion: 1, product: "Kyro", version: packageJson.version });
    expect(manifest.files.length).toBeGreaterThanOrEqual(16);
    for (const expected of manifest.files) {
      const data = await zip.file(expected.path)?.async("nodebuffer");
      expect(data, expected.path).toBeDefined();
      expect(data!.length, expected.path).toBe(expected.bytes);
      expect(digest(data!), expected.path).toBe(expected.sha256);
    }
    expect(Object.values(zip.files).filter(({ dir }) => !dir).map(({ name }) => name).sort()).toEqual(
      ["manifest.json", ...manifest.files.map(({ path }) => path)].sort(),
    );
  });
});
