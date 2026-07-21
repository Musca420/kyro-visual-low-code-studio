# KYRO 2.0 ARCHITECTURE REVIEW

Status: APPROVED

## Executive Summary

Kyro already has a working visual product: a versioned Zod Graph, visual editor, Flow Editor, IndexedDB persistence, Preview, web/PWA/Android export, CLI, desktop shell, MCP, and compact indexed Codex context. The architecture must evolve incrementally rather than be rewritten.

The principal contract gaps are: manual Graph mutations outside a common Transaction path, in-memory Agent Jobs and Live Bridge commands, runtime logs persisted inside the Graph, duplicated Preview/Export behavior, lexical capability routing, and incomplete security and verification boundaries.

## Current Architecture

- React and Vite provide the editor and local bridge; Electron and the `kyro` CLI host the same product.
- `src/model.ts` defines the single `formatVersion: 1` Project Graph, migration, reference validation, and deterministic serialization.
- `src/editorOperations.ts` provides pure typed operations, but does not yet cover every manual mutation in `src/App.tsx`.
- IndexedDB stores projects, versions, records, exports, plugins, Codex history, and global capability drafts.
- `src/flow.ts` interprets visual flows in the editor.
- `src/PreviewFrame.tsx` builds the iframe preview; `src/generator.ts` separately generates exported runtime code.
- `vite.config.ts` currently combines workspace access, Live Bridge, Codex jobs, terminal sessions, authentication, and Android builds.
- Codex receives a compact graph slice, structured schemas, a read-only sandbox, and authorized MCP operations.

## Strengths

- One readable, versionable and deterministically serialized Project Graph.
- Mature manual editor that remains usable without Codex.
- Typed agent operation registry, exact approved-plan checks, revision checks, and undo UI.
- Compact selection-based Codex context capped at 24 KB.
- Real web, PWA, generated backend and Android artifacts.
- Broad unit and browser coverage for canvas, flow, data, persistence, import and export.
- Sandboxed Electron renderer with context isolation and restricted navigation.

## Weaknesses

- Many manual controls call `change()` or `setProject()` with direct object updates.
- Live Bridge transactions, Codex jobs, Android jobs and terminal sessions are in-memory maps.
- Manual undo, Codex undo and filesystem rollback are separate mechanisms.
- `flowRuns` causes runtime execution to create Graph revisions.
- Preview and export retain separate renderers and behavior scripts.
- Capability selection uses prompt and intent keywords in `programGraph.ts` and `capabilityResolver.ts`.
- Live validation is published with empty error collections.
- The integrated terminal accepts arbitrary local shell commands.
- Capability contracts, lifecycle, artifact provenance, audit and Security Budget are incomplete.

## Current vs Contract

| Contract | Status | Current evidence |
| --- | --- | --- |
| G-01 Graph source of truth | Partial | The Project Graph is primary, but mutations and behavior have alternate paths. |
| G-02 Runtime does not mutate Graph | Failing | Flow runs are written into `project.flowRuns`. |
| G-03 Preview uses Runtime | Failing | Preview and export behavior are generated through separate paths. |
| G-04/G-05 Export and code derive from Graph | Partial | They derive from Graph but contain duplicated runtime branches. |
| G-05/G-06 Job and Transaction | Failing | Manual mutations bypass the agent transaction path. |
| G-07/G-08/G-15 evidence and verification | Partial | Codex can capture a preview; verification is not universal. |
| G-09/G-10 Codex optional | Passing | Manual editing remains available. |
| G-11 Capability contract vs Module | Partial | The concepts exist, but contracts and lifecycle are incomplete. |
| G-12 manual and Codex equality | Partial | Same Graph, different mutation routes. |
| G-13 no AI leakage | Partial | Specialized project markers can drive hidden generated behavior. |
| G-14 one application model | Partial | One Project exists, but it also contains runtime operational history. |
| Security Contract | Failing P0 | Shell, audit, budget, network, transaction and hostile tests are incomplete. |

## Architectural Risks

1. **Critical:** arbitrary integrated shell can affect the host workspace.
2. **Critical:** distributed mutation authority can bypass authorization, verification and audit.
3. **High:** jobs and commands are lost on bridge restart.
4. **High:** Preview/Export runtime drift can invalidate visual verification.
5. **High:** runtime logging mutates the application Graph.
6. **High:** lexical routing can select the wrong capability.
7. **Medium:** large coordinator modules increase coupling and race risk.
8. **Medium:** external dependency and plugin provenance is incomplete.

## Suggested Improvements

1. Keep `applyEditorOperation` as the pure mutation primitive and place one Core transaction boundary around it.
2. Convert existing manual mutations incrementally; never add an opaque unrestricted project replacement operation.
3. Persist Jobs, Transactions, audit, runtime runs and evidence outside the Project Graph.
4. Compile one deterministic runtime artifact set consumed by Preview and Export.
5. Let Codex interpret language while Core accepts only typed operation and capability identifiers.
6. Replace free shell input with an allow-listed task runner.
7. Select verification stages from declared transaction effects and store reproducible evidence.
8. Extract bridge responsibilities only when an implemented contract boundary requires it.

## Compatibilita

- Keep project `formatVersion: 1` through P0; new fields are additive and defaulted.
- Preserve v0 migration, v1 projects, project JSON names, CLI, Electron, IndexedDB and export formats.
- Keep legacy `flowRuns` readable but stop adding new runtime entries once the external run store exists.
- Preserve legacy `state.experience` through a compiler adapter; new templates use explicit components and flows.
- Route existing Ctrl+Z, history and Codex restore through the Transaction Engine without changing their visible behavior.
- Never delete or overwrite unrelated existing or untracked work.

