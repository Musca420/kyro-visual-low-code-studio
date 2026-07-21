/// <reference types="node" />
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export type JobAuditEvent = {
  id: string;
  jobId: string;
  timestamp: string;
  action: string;
  from?: string;
  to: string;
  attempt: number;
  detail?: string;
};

export type StoredJob = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  attempts?: number;
  timeoutMs?: number;
  deadlineAt?: string;
  errors?: string;
  audit?: JobAuditEvent[];
};

const inside = (root: string, path: string) => path === root || path.startsWith(`${root}${sep}`);

export class JobStore<T extends StoredJob> {
  private jobs = new Map<string, T>();
  private pending = Promise.resolve();

  constructor(
    private readonly workspaceRoot: string,
    private readonly storePath = resolve(workspaceRoot, ".kyro", "jobs.json"),
    private readonly auditPath = resolve(workspaceRoot, ".kyro", "job-audit.jsonl"),
  ) {
    const root = resolve(workspaceRoot);
    if (!inside(root, resolve(storePath)) || !inside(root, resolve(auditPath)))
      throw new Error("Job storage must remain inside the workspace.");
  }

  async initialize(now = new Date()): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    const values = await readFile(this.storePath, "utf8")
      .then((text) => JSON.parse(text) as T[])
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
    if (!Array.isArray(values)) throw new Error("Invalid persisted Job store.");
    for (const value of values) {
      if (!value || typeof value.id !== "string" || typeof value.status !== "string")
        throw new Error("Invalid persisted Job.");
      this.jobs.set(value.id, structuredClone(value));
    }
    for (const value of this.jobs.values()) {
      if (value.status !== "running") continue;
      const timedOut = value.deadlineAt ? Date.parse(value.deadlineAt) <= now.getTime() : false;
      await this.transition(
        value.id,
        "error",
        timedOut ? "timeout" : "interrupted",
        timedOut ? "The Job deadline elapsed while the bridge was unavailable." : "Bridge restarted before the Job completed.",
        now,
      );
    }
  }

  list(limit = 20): T[] {
    return [...this.jobs.values()]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit)
      .map((job) => structuredClone(job));
  }

  get(id: string): T | undefined {
    const value = this.jobs.get(id);
    return value ? structuredClone(value) : undefined;
  }

  async create(value: T, action = "created"): Promise<T> {
    if (this.jobs.has(value.id)) throw new Error(`Job ${value.id} already exists.`);
    const job = structuredClone({ ...value, attempts: value.attempts ?? 1, audit: value.audit ?? [] }) as T;
    this.jobs.set(job.id, job);
    await this.record(job, action, undefined, job.status);
    return structuredClone(job);
  }

  async update(id: string, change: (job: T) => void, action = "updated", detail?: string): Promise<T> {
    const current = this.jobs.get(id);
    if (!current) throw new Error(`Job ${id} was not found.`);
    const before = current.status;
    change(current);
    await this.record(current, action, before, current.status, detail);
    return structuredClone(current);
  }

  async transition(id: string, status: string, action: string, detail?: string, now = new Date()): Promise<T> {
    return this.update(id, (job) => {
      job.status = status;
      if (status !== "running") job.finishedAt = now.toISOString();
    }, action, detail);
  }

  private async record(job: T, action: string, from: string | undefined, to: string, detail?: string) {
    const event: JobAuditEvent = {
      id: crypto.randomUUID(), jobId: job.id, timestamp: new Date().toISOString(), action,
      ...(from ? { from } : {}), to, attempt: job.attempts ?? 1, ...(detail ? { detail } : {}),
    };
    job.audit = [...(job.audit ?? []), event];
    const snapshot = [...this.jobs.values()].map((value) => structuredClone(value));
    this.pending = this.pending.then(async () => {
      await mkdir(dirname(this.storePath), { recursive: true });
      const temporary = `${this.storePath}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(snapshot, null, 2), "utf8");
      await rename(temporary, this.storePath);
      await appendFile(this.auditPath, `${JSON.stringify(event)}\n`, "utf8");
    });
    await this.pending;
  }
}
