import { z } from "zod";
import { listAllRecords, listPlugins, listProjects, mergeDatabaseBackup } from "./db";
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
  return backupSchema.parse({
    format: "frontend-editor-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    projects: await listProjects(),
    records: await listAllRecords(),
    plugins: await listPlugins(),
    preferences,
  });
}

export async function restoreBackup(input: unknown) {
  const backup = backupSchema.parse(input);
  await mergeDatabaseBackup(backup.projects, backup.records, backup.plugins);
  Object.entries(backup.preferences).forEach(([key, value]) => {
    if (persistedKey(key)) localStorage.setItem(key, value);
  });
  return {
    projects: backup.projects.length,
    records: backup.records.length,
    plugins: backup.plugins.length,
  };
}

export function serializeBackup(backup: FrontendEditorBackup) {
  return JSON.stringify(backup, null, 2);
}

