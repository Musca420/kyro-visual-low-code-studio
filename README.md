# Kyro — Visual Low-Code Studio

> Build real applications visually. Use Codex exactly where the difficult work begins.

Kyro is an open, local-first studio for building Web, PWA, and Android applications. Design pages, connect behavior, model data, test the result, and export readable code—all from one versioned application graph.

When a change becomes difficult, **Ask Codex** sends only the relevant selection, dependencies, flows, data, errors, and available operations. Codex proposes a typed plan; you review it before Kyro applies the change as one verifiable, undoable transaction.

**The visual interface is not a mock-up in front of the program. It is the entry point to the program.**

| Design visually | Ask Codex in context |
| --- | --- |
| ![Kyro Design canvas](./docs/images/kyro-design-canvas.png) | ![Ask Codex typed plan](./docs/images/kyro-live-codex-plan.png) |

Built with Codex and GPT-5.6 for **OpenAI Build Week 2026 — Developer Tools**.

## Why Kyro

Visual builders are easy to start with, but often become restrictive when an application needs real behavior. Coding agents are powerful, but usually see files without knowing which visual element the user selected or how it relates to the rest of the product.

Kyro connects those two worlds:

1. Design the interface through direct manipulation.
2. Add reusable behavior with visual flows.
3. Model local or generated data and bind it to components.
4. Select a page, component, flow, or data source and ask Codex for a difficult change.
5. Review the exact plan, apply it once, inspect the result, and undo it atomically if needed.
6. Export a readable application that runs independently of Kyro.

Codex is optional. Manual and AI-assisted edits use the same Core, transaction boundary, runtime, Preview, and export pipeline.

## What makes it different

### One graph, not a collection of prompts

Pages, components, responsive styles, events, flows, data, permissions, capabilities, and provenance share stable IDs in a single versioned source of truth.

### Codex understands the current selection

Ask Codex receives a compact graph slice containing the selected object and its relevant dependencies. You do not need to explain the whole repository or copy selectors into a prompt.

### Changes are reviewable transactions

Planning is read-only. Kyro applies only the exact approved operations, against the approved project revision. Each transaction is validated, audited, persisted, and undoable.

### Unsupported features remain honest

When a request needs a missing package, provider, permission, backend, or native capability, Kyro can propose a reusable typed capability. Proposals remain inactive until their implementation, dependencies, permissions, and tests are explicitly reviewed.

### Export without lock-in

Projects remain local and versionable. Web and PWA exports use readable TypeScript and Vite. Android exports use Capacitor and can be built outside Kyro.

| Visual behavior | Data and bindings |
| --- | --- |
| ![Node-based visual flow](./docs/images/kyro-visual-flow.png) | ![Visual data model](./docs/images/kyro-data-model.png) |

## Try Kyro

Requirements:

- Node.js 20 or newer
- npm and Git
- a Chromium-based browser

Install the v2.1.0 release:

```bash
npm install -g https://github.com/Musca420/kyro-visual-low-code-studio/releases/download/v2.1.0/kyro-studio-2.1.0.tgz
kyro --home
```

Useful commands:

```bash
kyro --home            # Open Home to create or import a project
kyro                   # Open or import the current folder
kyro path/to/project   # Open a specific folder
kyro --check           # Inspect what Kyro would open without starting it
```

Kyro binds only to `127.0.0.1`, and project state remains in local IndexedDB. Building Android applications additionally requires Java 21 and the Android SDK.

### Build from source

```bash
git clone https://github.com/Musca420/kyro-visual-low-code-studio.git
cd kyro-visual-low-code-studio
npm ci
npm run check
npm link
kyro --home
```

## A five-minute walkthrough

1. Run `kyro --home` and create a blank project or import a folder.
2. Add a page and drag components onto the canvas.
3. Resize and nest components, then check Desktop, Tablet, and Mobile.
4. Select a component, open **Actions**, and connect an event to a visual flow.
5. Right-click the component and choose **Ask Codex**.
6. Inspect the captured context and typed plan before approving it.
7. Open **Preview**, test the behavior, and try undoing the transaction.
8. Open **Publish** and export a Web/PWA or Android project.

For a prepared output, see the [NexusField demo release](https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v0.1.15), including an independent Web/PWA export, Android APK, and validation evidence.

## How Ask Codex works

```text
Selection + dependencies + errors
                │
                ▼
        Compact graph context
                │
                ▼
        Read-only Codex plan
                │
                ▼
           User approval
                │
                ▼
   Typed transaction → verification → new graph revision
                │
                ├── Preview
                ├── Undo
                └── Export
```

The agent bridge is intentionally narrow:

- authorization is scoped to one project, client, revision, and deadline;
- planning cannot mutate the project;
- approved operations are compared exactly with attempted operations;
- a plan can be applied only once;
- tools declare their access and effects;
- external services, secrets, dependencies, signing, and publication require explicit approval.

Imported source is analyzed but never executed automatically.

## Verification

Run the portable verification path:

```bash
npm run check
npm run test:e2e

npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated
```

The v2.1.0 release records:

- **241** unit and integration tests passed;
- **55** standard Playwright scenarios passed on the prepared release workstation;
- an independently installed and built Web export;
- headed desktop and mobile interaction checks with zero console or runtime errors;
- a generated Android project built with Capacitor 8 and Gradle, producing a verified debug APK;
- a fresh installation test using the published CLI tarball.

Three clean-runner environment gates remain explicit: a full Android build, reimport of generated Android source, and already-running specialized exports.

The reproducible proof bundle is available at [`release/kyro-2.1.0-evidence.zip`](./release/kyro-2.1.0-evidence.zip). See also:

- [`CHANGELOG.md`](./CHANGELOG.md)
- [`NEXUSFIELD_VALIDATION_REPORT.md`](./NEXUSFIELD_VALIDATION_REPORT.md)
- [`ROLLBACK.md`](./ROLLBACK.md)

## Context benchmark

Kyro includes a reproducible ten-prompt benchmark designed to measure one specific question:

> What changes when Codex receives the active visual selection, stable graph IDs, linked dependencies, typed operations, approval, and Preview verification?

The test begins with byte-identical exported projects and sends ten cumulative tasks covering styling, responsive layout, validation, schema evolution, CRUD flows, dependency repair, accessibility, capability proposals, and dashboard filtering.

| Result across ten cumulative prompts | Kyro | Codex CLI baseline |
| --- | ---: | ---: |
| Functionally accepted | **10/10** | **0/10** |
| Median wall time | 44.8 s | **27.0 s** |
| Total tokens | 784.3k | **763.6k** |
| Output tree | Changed and independently verified | Unchanged from baseline |

This is **not a general benchmark of Kyro against Codex CLI**. The prompts intentionally depend on live visual selection and graph tools, while the CLI baseline runs in fresh sessions without the Kyro Live Bridge. The result isolates the value of Kyro's contextual execution path; it does not claim lower latency, lower token use, or superior general coding ability.

The complete material is published for inspection:

- [benchmark protocol](./docs/benchmarks/kyro-vs-codex-cli-10-prompts.json)
- [scored results](./docs/benchmarks/2026-07-21-kyro-vs-codex-cli-10-results.json)
- [raw Kyro run](./docs/benchmarks/2026-07-21-kyro-10-raw.json)
- [raw CLI run](./docs/benchmarks/2026-07-21-codex-cli-10-raw.json)
- [`benchmark-kyro-vs-cli-10.mjs`](./scripts/benchmark-kyro-vs-cli-10.mjs)
- [`benchmark-codex-cli-10.ps1`](./scripts/benchmark-codex-cli-10.ps1)

![Kyro and Codex CLI context benchmark](./docs/images/kyro-vs-codex-cli-10.svg)

## Architecture

```text
Visual Editor ─┐
Ask Codex ─────┼── typed operation ── Transaction Engine ── Graph revision
Manual Flow ───┘                            │
                                            ├── Verification
                                            ├── Preview / Runtime
                                            └── Export
```

Key modules:

- `src/model.ts` — validated, versioned application graph.
- `src/projectCore.ts` — authority and atomic graph mutations.
- `src/transactionEngine.ts` — revision checks, audit, persistence, replay protection, and rollback.
- `src/verification.ts` — graph, runtime, behavior, visual, and build-preflight stages.
- `src/flow.ts` — deterministic visual-flow runtime and traces.
- `src/PreviewFrame.tsx` — sandboxed interactive Preview.
- `src/generator.ts` — Web, PWA, Android, and local-backend generation.
- `src/CodexPanel.tsx` — context, plans, approval, evidence, history, and undo.
- `server/kyroMcp.mjs` — allow-listed typed tools for contextual Codex work.
- `.agents/skills/` — focused design, application, data, action, native, testing, and publishing workflows.

## Build Week

Kyro began as a pre-existing local visual-editor prototype. Commit [`38a72eb`](https://github.com/Musca420/kyro-visual-low-code-studio/commit/38a72eb3467d28371a9c3d0894753a3c2bcf9321) is the imported baseline dated **18 July 2026**.

The Build Week work added the unified graph context, stable contextual selection, Live Bridge, Codex transactions and undo, visual flows, data bindings, generated backend, native capability nodes, folder import, CLI distribution, Web/PWA/Android export, security boundaries, and browser/device verification.

Development used Codex and GPT-5.6 for repository analysis, architecture, implementation, test generation, visual verification, Android deployment, security review, benchmarking, and release documentation. Product direction and final decisions remained human-owned.

For submission details and boundaries, see:

- [`HACKATHON_COMPLIANCE.md`](./HACKATHON_COMPLIANCE.md)
- [`CODEX_SESSION_EVIDENCE.md`](./CODEX_SESSION_EVIDENCE.md)
- [`DEVPOST_SUBMISSION.md`](./DEVPOST_SUBMISSION.md)

## License

Kyro is released under the [MIT License](./LICENSE).

Copyright © 2026 Kyro contributors.
