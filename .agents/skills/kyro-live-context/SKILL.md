---
name: kyro-live-context
description: "Inspect the active Kyro visual project through its compact graph context: current page, selection, component intent, linked actions, data, runtime errors and revision. Use before any agent change inside Kyro so work targets stable IDs without scanning the repository."
---

# Kyro live context

1. Treat the supplied context, graph revision and stable IDs as the source of truth.
2. Do not run shell commands or read project files. Use `kyro_get_context` only for a missing indexed slice and `kyro_resolve_capability` only for missing capability facts.
3. During planning, select the smallest matching domain skill and return typed Kyro operations with observable acceptance checks.
4. During apply, use `kyro_apply_verified_transaction` exactly once with the approved operations. It applies the transaction, waits for the next revision, validates and returns preview evidence in one round. Do not expand or reinterpret the approved scope.
5. Report the transaction, final revision, validation and visual result returned by that tool.
6. If validation or visual inspection fails, stop and propose a corrected plan. Do not apply unapproved corrective operations.
7. Keep destructive actions, dependency approvals, credentials and publishing behind explicit confirmation.

Read [context-contract.md](references/context-contract.md) when the supplied focus or dependency slice is incomplete.
