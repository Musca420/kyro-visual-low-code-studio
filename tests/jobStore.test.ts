import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JobStore, type StoredJob } from "../server/jobStore";

type TestJob = StoredJob & { projectId: string };
const running = (id: string): TestJob => ({
  id, projectId: "project-1", status: "running", startedAt: "2026-07-20T08:00:00.000Z",
  timeoutMs: 60_000, deadlineAt: "2026-07-20T08:01:00.000Z",
});

describe("persistent Agent Job store", () => {
  it("persists transitions and an append-only audit", async () => {
    const root = await mkdtemp(join(tmpdir(), "kyro-jobs-"));
    const store = new JobStore<TestJob>(root);
    await store.initialize();
    await store.create(running("job-1"));
    await store.transition("job-1", "completed", "completed");

    const reopened = new JobStore<TestJob>(root);
    await reopened.initialize();
    expect(reopened.get("job-1")).toMatchObject({ status: "completed", attempts: 1 });
    const audit = await readFile(join(root, ".kyro", "job-audit.jsonl"), "utf8");
    expect(audit.trim().split("\n").map((line) => JSON.parse(line).action)).toEqual(["created", "completed"]);
  });

  it("recovers an interrupted running Job after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "kyro-jobs-"));
    const first = new JobStore<TestJob>(root);
    await first.initialize();
    await first.create(running("job-2"));

    const reopened = new JobStore<TestJob>(root);
    await reopened.initialize(new Date("2026-07-20T08:00:30.000Z"));
    const recovered = reopened.get("job-2");
    expect(recovered).toMatchObject({ status: "error", finishedAt: "2026-07-20T08:00:30.000Z" });
    expect(recovered?.audit?.at(-1)).toMatchObject({ action: "interrupted", from: "running", to: "error" });
  });

  it("records timeout instead of interruption when the persistent deadline elapsed", async () => {
    const root = await mkdtemp(join(tmpdir(), "kyro-jobs-"));
    const first = new JobStore<TestJob>(root);
    await first.initialize();
    await first.create(running("job-timeout"));
    const reopened = new JobStore<TestJob>(root);
    await reopened.initialize(new Date("2026-07-20T08:01:01.000Z"));
    expect(reopened.get("job-timeout")?.audit?.at(-1)?.action).toBe("timeout");
  });

  it("rejects storage paths outside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "kyro-jobs-"));
    expect(() => new JobStore<TestJob>(root, join(root, "..", "jobs.json"))).toThrow(/inside the workspace/);
  });
});
