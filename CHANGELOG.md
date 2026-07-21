# Changelog

All notable changes to Kyro are documented here. Versions follow Semantic Versioning.

## [2.1.0] - 2026-07-21

### Added

- A typed `compose_collection_filter` operation that creates reusable filter controls, state, flows, counters, empty states, and safe schema migrations.
- A 50-case operation matrix covering stable index/sibling targeting and composable agent changes.
- A reproducible ten-prompt Kyro versus Codex CLI benchmark with raw telemetry, real screenshots, independent export verification, and explicit limitations.
- Reusable versioned capability proposals with bounded, typed input/output ports for unsupported requests such as PDF generation.

### Fixed

- Agent plans no longer fail because descriptive capability ports exceed the response schema or omit a schema `type`.
- Context stays within the 24 KB bridge budget while preserving selection, dependencies, flows, bindings, errors, and operation contracts.
- Failed validation delivers all error UI operations so focus returns to the invalid field.
- Filter state, record rendering, counters, empty states, and dynamic UI values behave consistently in Preview and exported applications.
- Optional due dates render immediately after CRUD refresh as well as after a flow update.
- PowerShell benchmarks pass long prompts to Codex CLI without argument splitting.

### Removed

- Unsupported unsigned desktop packaging and its obsolete build/update workflow. The supported distribution is the cross-platform `kyro` CLI.

### Verification

- 241 unit/integration tests and 55 Playwright scenarios pass; two environment-gated scenarios remain explicit.
- All ten cumulative Ask Codex prompts completed from a clean visual baseline.
- The final Web export installed, built, ran independently, persisted records, and passed desktop/mobile interaction checks with zero runtime errors.

## [2.0.0] - 2026-07-21

### Added

- A single typed Core and Transaction boundary for manual, Codex, undo and restore mutations.
- Persistent Agent Jobs with resume, retry, restart, cancellation, timeout and append-only audit.
- A verified `RuntimeProgram` shared by Preview and Web/PWA/Android export.
- Security budgets, confined task execution, secret redaction and typed MCP authorization.
- Versioned capability contracts, safe Open Mode and globally reusable verified modules.
- Plain-language Codex approval, evidence and undo controls.
- Content-addressed Artifact Registry with backup/restore integrity checks.
- Three reproducible browser demos covering imported projects, global visual edits and a four-page data application.

### Changed

- Capability selection uses typed domains and capability IDs instead of lexical Core routing.
- Runtime traces and operational history are stored outside the Project Graph.
- Dashboard Preview and multipage export now share CRUD behavior and responsive mobile navigation.

### Security

- Project changes require authorization, verification, audit and atomic persistence.
- Filesystem traversal, symlink escape, shell injection, unauthorized network access, secret leakage and unapproved dependency paths are denied and tested.

### Compatibility

- Project `formatVersion: 1`, v0 migration, IndexedDB data, CLI usage and existing Web/PWA/Android export formats remain supported.
- Codex remains optional; manual and Codex operations produce the same portable product graph.

[2.0.0]: https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v2.0.0
[2.1.0]: https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v2.1.0
