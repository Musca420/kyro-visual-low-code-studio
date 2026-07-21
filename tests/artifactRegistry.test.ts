import { describe, expect, it } from "vitest";
import { createArtifact, createScreenshotArtifact, verifyArtifact } from "../src/artifactRegistry";
import { mergeDatabaseBackup } from "../src/db";

const provenance = { actor: "codex" as const, source: "codex" as const, revision: 4, jobId: "job-1", transactionId: "tx-1", phase: "result" as const };

describe("artifact registry contract", () => {
  it("hashes reports, screenshots, traces, builds and exports with stable provenance", async () => {
    const kinds = ["report", "trace", "build", "export"] as const;
    const records = await Promise.all(kinds.map((kind) => createArtifact({ projectId: "project", kind, name: kind, mediaType: "application/octet-stream", payload: `real ${kind} payload`, provenance })));
    records.push(await createScreenshotArtifact({ projectId: "project", name: "before", dataUrl: "data:image/png;base64,aW1hZ2U=", provenance: { ...provenance, phase: "before" } }));
    expect(records.map((item) => item.kind)).toEqual(["report", "trace", "build", "export", "screenshot"]);
    for (const record of records) {
      expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
      await expect(verifyArtifact(record)).resolves.toMatchObject({ passed: true });
      expect(record.location).toBe(`indexeddb:artifacts/${record.id}`);
    }
    const replay = await createArtifact({ projectId: "project", kind: "trace", name: "renamed retry", mediaType: "application/json", payload: "real trace payload", provenance, createdAt: "2026-07-20T00:00:00.000Z" });
    expect(replay.id).toBe(records[1].id);
  });

  it("detects content and provenance corruption before backup restore", async () => {
    const valid = await createArtifact({ projectId: "project", kind: "report", name: "report", mediaType: "application/json", payload: "verified", provenance });
    const corrupted = { ...valid, data: btoa("tampered") };
    await expect(verifyArtifact(corrupted)).resolves.toMatchObject({ passed: false, issues: expect.arrayContaining(["Content hash does not match"]) });
    const moved = { ...valid, provenance: { ...valid.provenance, revision: 5 } };
    await expect(verifyArtifact(moved)).resolves.toMatchObject({ passed: false, issues: expect.arrayContaining(["Provenance identity does not match"]) });
    await expect(mergeDatabaseBackup([], [], [], [], [], [], [], [], [], [corrupted])).rejects.toThrow(/integrity verification/i);
  });
});

