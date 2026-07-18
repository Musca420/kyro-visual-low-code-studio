import { z } from "zod";
import { codexTimelineEntrySchema, listAllCodexTimeline, listAllExports, listAllProjectVersions, listAllRecords, listPlugins, listProjects, mergeDatabaseBackup } from "./db";
import { pluginManifestSchema, projectSchema } from "./model";

const localRecordSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  text: z.string(),
  date: z.string(),
  description: z.string().optional(),
  status: z.enum(["Planned", "In progress", "Completed", "On hold"]).optional(),
  priority: z.enum(["Low", "Medium", "High"]).optional(),
  dueDate: z.string().optional(),
});

const backupSchema = z.object({
  format: z.literal("frontend-editor-backup"),
  version: z.literal(1),
  createdAt: z.string(),
  projects: z.array(projectSchema).max(500),
  records: z.array(localRecordSchema).max(50_000),
  plugins: z.array(pluginManifestSchema).max(500),
  preferences: z.record(z.string(), z.string()),
  codexTimeline: z.array(codexTimelineEntrySchema).max(2_000).default([]),
  versions: z.array(z.object({
    id: z.string(), projectId: z.string(), revision: z.number().int().nonnegative(),
    createdAt: z.string(), project: projectSchema,
  })).max(5_000).default([]),
  exports: z.array(z.object({
    id: z.string(), projectId: z.string(), fileName: z.string(), target: z.string(),
    createdAt: z.string(), type: z.string(), data: z.string().max(14_000_000),
  })).max(200).default([]),
});

export type FrontendEditorBackup = z.infer<typeof backupSchema>;
const persistedKey = (key: string) =>
  key === "frontend-editor-theme" ||
  key.startsWith("frontend-editor-codex-history:") ||
  key.startsWith("frontend-editor-desktop:");

export async function createBackup(): Promise<FrontendEditorBackup> {
  const preferences: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !persistedKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) preferences[key] = value;
  }
  const exports = await listAllExports();
  return backupSchema.parse({
    format: "frontend-editor-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    projects: await listProjects(),
    records: await listAllRecords(),
    plugins: await listPlugins(),
    preferences,
    codexTimeline: await listAllCodexTimeline(),
    versions: await listAllProjectVersions(),
    exports: await Promise.all(exports.map(async (record) => {
      const bytes = new Uint8Array(await record.blob.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      return { ...record, blob: undefined, type: record.blob.type, data: btoa(binary) };
    })),
  });
}

export async function restoreBackup(input: unknown) {
  const backup = backupSchema.parse(input);
  await mergeDatabaseBackup(
    backup.projects,
    backup.records,
    backup.plugins,
    backup.codexTimeline,
    backup.versions,
    backup.exports.map((record) => {
      const binary = atob(record.data);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return { id: record.id, projectId: record.projectId, fileName: record.fileName, target: record.target, createdAt: record.createdAt, blob: new Blob([bytes], { type: record.type }) };
    }),
  );
  Object.entries(backup.preferences).forEach(([key, value]) => {
    if (persistedKey(key)) localStorage.setItem(key, value);
  });
  return {
    projects: backup.projects.length,
    records: backup.records.length,
    plugins: backup.plugins.length,
    versions: backup.versions.length,
    exports: backup.exports.length,
  };
}

export function serializeBackup(backup: FrontendEditorBackup) {
  return JSON.stringify(backup, null, 2);
}
