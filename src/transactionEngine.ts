import { commitProjectTransaction, getProjectTransaction, saveFailedProjectTransaction } from "./db";
import { applyProjectTransaction, type ProjectTransactionRequest } from "./projectCore";
import type { EditorOperation } from "./editorOperations";
import type { Project } from "./model";
import { failedVerification, verifyProjectTransaction, type VerificationReport } from "./verification";

export type TransactionAuditEvent = {
  timestamp: string;
  action: "authorized" | "verified" | "applied" | "replayed" | "failed" | "rolled_back";
  detail?: string;
};

export type ProjectTransactionRecord = {
  id: string;
  projectId: string;
  actor: ProjectTransactionRequest["actor"];
  jobId?: string;
  pageId: string;
  baseRevision: number;
  finalRevision?: number;
  operationHash: string;
  operations: EditorOperation[];
  authorization: ProjectTransactionRequest["authorization"];
  status: "applied" | "failed" | "rolled_back";
  retryOf?: string;
  rollbackOf?: string;
  beforeProject: Project;
  afterProject?: Project;
  error?: string;
  createdAt: string;
  completedAt: string;
  audit: TransactionAuditEvent[];
  verification: VerificationReport;
};

export type TransactionRepository = {
  get(id: string): Promise<ProjectTransactionRecord | undefined>;
  commit(record: ProjectTransactionRecord): Promise<ProjectTransactionRecord>;
  saveFailed(record: ProjectTransactionRecord): Promise<ProjectTransactionRecord>;
};

const defaultRepository: TransactionRepository = {
  get: getProjectTransaction,
  commit: commitProjectTransaction,
  saveFailed: saveFailedProjectTransaction,
};

const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
    : value;

export async function operationFingerprint(operations: EditorOperation[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(operations)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function executeProjectTransaction(project: Project, request: ProjectTransactionRequest, repository: TransactionRepository = defaultRepository, verifier = verifyProjectTransaction) {
  const operationHash = await operationFingerprint(request.operations);
  const existing = await repository.get(request.transactionId);
  if (existing) {
    if (existing.projectId !== project.id || existing.operationHash !== operationHash)
      throw new Error("A transaction ID cannot be reused with different operations");
    if (existing.status === "failed") throw new Error(existing.error || "The previous transaction attempt failed");
    return { project: project.revision < (existing.finalRevision ?? 0) && existing.afterProject ? existing.afterProject : project, transaction: existing, replayed: true };
  }

  const createdAt = request.timestamp ?? new Date().toISOString();
  let verification: VerificationReport | undefined;
  try {
    const applied = applyProjectTransaction(project, request);
    verification = await verifier(project, applied.project, request.operations);
    if (verification.status !== "verified") {
      const failed = verification.stages.find((stage) => stage.status === "failed");
      throw new Error(`Verification failed${failed ? ` (${failed.name}): ${failed.detail}` : ""}`);
    }
    const record: ProjectTransactionRecord = {
      ...applied.transaction,
      pageId: request.pageId,
      operationHash,
      status: request.rollbackOf ? "rolled_back" : "applied",
      beforeProject: project,
      afterProject: applied.project,
      createdAt,
      completedAt: new Date().toISOString(),
      verification,
      audit: [
        { timestamp: createdAt, action: "authorized" },
        { timestamp: verification.completedAt, action: "verified", detail: `${verification.stages.filter((stage) => stage.status === "passed").length} stages passed` },
        { timestamp: new Date().toISOString(), action: request.rollbackOf ? "rolled_back" : "applied" },
      ],
      ...(request.authorization.kind === "approved_job" ? { jobId: request.authorization.jobId } : {}),
    };
    const persisted = await repository.commit(record);
    return { project: persisted.afterProject ?? applied.project, transaction: persisted, replayed: persisted.id === record.id && persisted.completedAt !== record.completedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await repository.saveFailed({
      id: request.transactionId, projectId: project.id, actor: request.actor, pageId: request.pageId,
      baseRevision: request.baseRevision, operationHash, operations: request.operations,
      authorization: request.authorization, status: "failed", beforeProject: project,
      createdAt, completedAt: new Date().toISOString(), error: message,
      verification: verification ?? failedVerification(project, request.operations, message),
      audit: [{ timestamp: createdAt, action: "authorized" }, { timestamp: new Date().toISOString(), action: "failed", detail: message }],
      ...(request.authorization.kind === "approved_job" ? { jobId: request.authorization.jobId } : {}),
      ...(request.retryOf ? { retryOf: request.retryOf } : {}),
      ...(request.rollbackOf ? { rollbackOf: request.rollbackOf } : {}),
    });
    throw error;
  }
}

export async function rollbackProjectTransaction(project: Project, targetId: string, request: Omit<ProjectTransactionRequest, "operations" | "rollbackOf">, repository: TransactionRepository = defaultRepository) {
  const target = await repository.get(targetId);
  if (!target || target.projectId !== project.id || target.status !== "applied") throw new Error("The target transaction cannot be rolled back");
  return executeProjectTransaction(project, {
    ...request,
    rollbackOf: targetId,
    operations: [{ type: "restore_project_revision", args: { project: target.beforeProject, confirmed: true } }],
  }, repository);
}
