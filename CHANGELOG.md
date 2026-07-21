# Changelog

All notable changes to Kyro are documented here. Versions follow Semantic Versioning.

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
