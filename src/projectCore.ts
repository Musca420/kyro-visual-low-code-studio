import { applyEditorOperation, type EditorOperation } from "./editorOperations";
import { parseProject, type Project } from "./model";

export type ProjectTransactionRequest = {
  transactionId: string;
  actor: "manual" | "codex" | "system";
  projectId: string;
  pageId: string;
  baseRevision: number;
  operations: EditorOperation[];
  timestamp?: string;
  authorization:
    | { kind: "user" }
    | { kind: "approved_job"; jobId: string }
    | { kind: "internal"; capability: string };
  retryOf?: string;
  rollbackOf?: string;
};

export function applyProjectTransaction(project: Project, request: ProjectTransactionRequest) {
  if (!request.transactionId.trim()) throw new Error("A transaction ID is required");
  if (request.actor === "manual" && request.authorization.kind !== "user") throw new Error("Manual transactions require user authorization");
  if (request.actor === "codex" && (request.authorization.kind !== "approved_job" || !request.authorization.jobId.trim())) throw new Error("Codex transactions require an approved Job");
  if (request.actor === "system" && (request.authorization.kind !== "internal" || !request.authorization.capability.trim())) throw new Error("System transactions require an internal capability");
  if (request.projectId !== project.id) throw new Error("The transaction targets another project");
  if (request.baseRevision !== project.revision) throw new Error("The project revision changed before the transaction");
  if (!request.operations.length || request.operations.length > 50) throw new Error("A transaction requires 1 to 50 operations");
  if (request.operations.some((operation) => operation.type === "apply_editor_transaction")) throw new Error("Nested transactions are not supported");

  const changed = applyEditorOperation(project, request.pageId, {
    type: "apply_editor_transaction",
    args: { operations: request.operations },
  });
  const next = parseProject({
    ...changed,
    revision: project.revision + 1,
    updatedAt: request.timestamp ?? new Date().toISOString(),
  });
  return {
    project: next,
    transaction: {
      id: request.transactionId,
      actor: request.actor,
      projectId: project.id,
      baseRevision: project.revision,
      finalRevision: next.revision,
      operations: request.operations,
      authorization: request.authorization,
      ...(request.retryOf ? { retryOf: request.retryOf } : {}),
      ...(request.rollbackOf ? { rollbackOf: request.rollbackOf } : {}),
    },
  };
}
