# KYRO 2.0 IMPLEMENTATION PLAN

Status: APPROVED

Estimates are complete implementation-test-review-checklist cycles. Work follows the checklist order without skipping priority.

## Public Contracts

- `KyroJob`: actor, project, state, attempts, timeout, context, transactions and audit events.
- `ProjectTransaction`: project, base/final revision, typed operations, confirmation, rollback state and verification result.
- `CapabilityContract`: versioned inputs, outputs, effects, permissions, dependencies, platforms, implementation and lifecycle.
- `RuntimeProgram` and `RuntimeAdapter`: deterministic Graph compilation plus platform-specific data, UI, network and native effects.
- `VerificationReport`: graph, runtime, behavior, visual and build checks with evidence.
- `ArtifactRecord`: hash, provenance, Job, Transaction, revision, platform and storage location.
- `SecurityBudget`: explicit filesystem, shell, network, process, dependency, build and adapter limits.

## P0

### P0.1 CORE

- **Objective:** make Core the only authority for typed project mutations and structured capability decisions.
- **Reason:** satisfy G-01, G-06, G-12 and S-01 while reusing the stable operation engine.
- **Files:** `src/core/*`, `src/App.tsx`, `src/editorOperations.ts`.
- **Dependencies:** none.
- **Tests:** manual/Codex equivalence, stale revision, atomic operations, handler coverage, no lexical Core routing.
- **Risk/estimate:** high, 4 cycles.
- **Complete when:** no persistent mutation bypasses Core and capability decisions use typed Graph signals.

### P0.2 AGENT JOB

- **Objective:** persistent resume, retry, cancel, restart, timeout and audit.
- **Reason:** current in-memory jobs disappear on restart.
- **Files:** `server/jobs/*`, `src/db.ts`, `src/CodexPanel.tsx`.
- **Dependencies:** P0.1.
- **Tests:** restart, idempotent retry, cancel, timeout and Codex thread resume.
- **Risk/estimate:** medium-high, 3 cycles.
- **Complete when:** interrupted jobs are recoverable and every transition is audited.

### P0.3 TRANSACTION ENGINE

- **Objective:** atomic, idempotent, authorized, revisioned and reversible transactions.
- **Reason:** command queues and React history are not a complete transaction engine.
- **Files:** `src/core/transactions/*`, `src/db.ts`, `server/workspaceTransactions.ts`.
- **Dependencies:** P0.1-P0.2.
- **Tests:** replay, race, rollback, revision conflict, partial failure and crash recovery.
- **Risk/estimate:** high, 4 cycles.
- **Complete when:** manual, Codex, undo and restore use the same contract.

### P0.4 RUNTIME

- **Objective:** compile one `RuntimeProgram` for Preview, web/PWA export and Android wrapper.
- **Reason:** remove runtime drift and persistent runtime Graph writes.
- **Files:** `src/runtime/*`, `src/PreviewFrame.tsx`, `src/generator.ts`.
- **Dependencies:** P0.1 and P0.3.
- **Tests:** DOM/flow parity, CRUD, routing, responsive, offline, errors and native fallback.
- **Risk/estimate:** high, 5 cycles.
- **Complete when:** Preview and Export consume the same verified runtime artifacts.

### P0.5 SECURITY

- **Objective:** enforce shell, filesystem, network, dependency, secret, trust and budget policies.
- **Reason:** the current terminal and bridge do not satisfy the Security Contract.
- **Files:** `server/security/*`, `vite.config.ts`, `src/TerminalPanel.tsx`.
- **Dependencies:** P0.2-P0.3.
- **Tests:** path/symlink escape, shell injection, origin/token, secret leakage and dependency approval.
- **Risk/estimate:** high, 4 cycles.
- **Complete when:** every effect is confined, authorized and audited.

### P0.6 VERIFICATION

- **Objective:** produce a `VerificationReport` and evidence for every transaction.
- **Reason:** applied is not equivalent to verified.
- **Files:** `src/verification/*`, `src/core/transactions/*`, `src/capture.ts`.
- **Dependencies:** P0.3-P0.5.
- **Tests:** validation, runtime, behavior, visual and build failures with safe rollback.
- **Risk/estimate:** medium-high, 3 cycles.
- **Complete when:** each transaction is verified, rolled back or failed with evidence.

### P0.7 MCP

- **Objective:** typed Read/Write/Verify/Build/Plan tools with explicit effects and authorization.
- **Reason:** current tools do not declare the complete security model.
- **Files:** `server/mcp/*`, `server/kyroMcp.mjs`, `server/agentContext.ts`.
- **Dependencies:** all previous P0 work.
- **Tests:** wrong scope, excess operation, expired authorization, audit and no-shell enforcement.
- **Risk/estimate:** medium, 2 cycles.
- **Complete when:** all tools pass through Core, Security and Verification.

## P1

### P1.1 CAPABILITY

- **Objective/reason:** complete contract and lifecycle from draft to active, deprecated or blocked.
- **Files:** `src/capabilities/*`, `src/globalCapability.ts`, `src/nativeCapabilities.ts`.
- **Dependencies:** P0.
- **Tests:** activation, version, platform, migration, proofs and rollback.
- **Risk/estimate:** medium, 3 cycles.
- **Complete when:** no capability is active without a versioned contract and passing evidence.

### P1.2 OPEN MODE

- **Objective/reason:** resolve unsupported requests through limitation, alternatives, approval, implementation, verification and registration without silent installation.
- **Files:** `src/openMode/*`, `src/capabilityResolver.ts`, `src/PluginManager.tsx`.
- **Dependencies:** P1.1 and Security.
- **Tests:** missing capability, local module, refused/approved dependency, failed verification and global reuse.
- **Risk/estimate:** high, 4 cycles.
- **Complete when:** unsupported work has a safe real resolution or an explicit limitation, never a simulation.

### P1.3 PRODUCT CONSISTENCY

- **Objective/reason:** prove identical Graph, components and flows across manual, Codex, Preview, Export and reimport.
- **Files:** `src/model.ts`, `src/runtime/*`, round-trip tests.
- **Dependencies:** Runtime and Capability.
- **Tests:** Graph round trip, manual/Codex equivalence, v0/v1 and legacy templates.
- **Risk/estimate:** medium, 2 cycles.
- **Complete when:** there is no loss and no AI-only behavior.

### P1.4 UX

- **Objective/reason:** expose plan, impact, authorization, verification, evidence and undo in plain language.
- **Files:** `src/CodexPanel.tsx`, `src/ComponentActions.tsx`, `src/styles.css`.
- **Dependencies:** Transaction, Verification and Open Mode.
- **Tests:** keyboard, accessibility, light/dark, mobile, rejection and undo.
- **Risk/estimate:** low-medium, 2 cycles.
- **Complete when:** users can understand and control every proposed change.

### P1.5 ARTIFACT REGISTRY

- **Objective/reason:** store hashed screenshots, traces, reports, builds and exports with provenance.
- **Files:** `src/artifacts/*`, `src/db.ts`, `server/audit/*`.
- **Dependencies:** Verification.
- **Tests:** hashing, corruption, backup/restore and Job-Transaction-Artifact linkage.
- **Risk/estimate:** medium, 2 cycles.
- **Complete when:** important evidence is reproducible and traceable.

## P2

### P2.1 DEMOS A/B/C

- **Objective/reason:** certify manual editing, Codex acceleration and safe failure/rollback without code access.
- **Files:** browser scenarios, fixtures and evidence reports.
- **Dependencies:** P0-P1.
- **Tests:** responsive, persistence, Preview/Export, optional Codex and rollback.
- **Risk/estimate:** low, 2 cycles.
- **Complete when:** all three demos reproduce from a clean workspace with evidence.

### P2.2 RELEASE AND OPTIMIZATION

- **Objective/reason:** produce a reproducible release, changelog, evidence bundle, rollback and only measured optimizations.
- **Files:** package/release scripts, README and CI.
- **Dependencies:** all prior work.
- **Tests:** clean clone, CLI/desktop install, full suite, web/Android export and security suite.
- **Risk/estimate:** medium, 2 cycles.
- **Complete when:** the checklist is DONE with no blocking regression.

## Compatibility and Defaults

- No rewrite and no second application model.
- No new dependency unless the existing stack or standard library cannot satisfy a demonstrated requirement and approval is recorded.
- Keep project format 1 through P0; operational state remains outside the Graph.
- Codex interprets language; Core accepts only typed operations and capability IDs.
- Convert the integrated free shell to an allow-listed task runner during SECURITY.
- The first execution activity is CORE and remains IN_PROGRESS until all its completion criteria are evidenced.
