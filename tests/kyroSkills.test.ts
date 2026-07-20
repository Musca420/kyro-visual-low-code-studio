import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Kyro agent skill suite", () => {
  it("exposes one MCP-first Kyro vocabulary without legacy Frontend Editor skills", async () => {
    const root = resolve(process.cwd(), ".agents/skills");
    const directories = await readdir(root, { withFileTypes: true });
    const skillFiles = directories.filter((entry) => entry.isDirectory()).map((entry) => resolve(root, entry.name, "SKILL.md"));
    const documents = (await Promise.all(skillFiles.map(async (path) => readFile(path, "utf8").catch(() => "")))).filter(Boolean);
    const names = documents.map((document) => document.match(/^name:\s*(.+)$/m)?.[1]);
    expect(names).toEqual(expect.arrayContaining([
      "kyro-live-context", "kyro-design", "kyro-app", "kyro-data", "kyro-actions",
      "kyro-native", "kyro-extensions", "kyro-publish", "kyro-test",
    ]));
    expect(names.some((name) => name?.startsWith("frontend-editor-"))).toBe(false);
    expect(documents.join("\n")).not.toMatch(/invoke_live_tool|check_live_bridge/i);
  });
});
