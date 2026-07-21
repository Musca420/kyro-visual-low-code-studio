# Kyro — Visual Low-Code Studio

> **Design like a creative tool. Program through a graph. Give Codex the exact context it needs.**

Kyro is an open, local-first visual studio for building real Web, PWA, and Android applications. Pages, components, events, flows, data, native capabilities, and generated files live in one versioned Graph. A visual user can build without AI; when a request becomes difficult, **Ask Codex** receives the selected graph slice and proposes a typed, reviewable, verifiable transaction.

Built with **Codex and GPT‑5.6** for the **OpenAI Build Week 2026 — Developer Tools** track.

| Design visually | Ask Codex in context |
| --- | --- |
| ![Kyro Design canvas with pages, layers, responsive viewport, and visual properties](./docs/images/kyro-design-canvas.png) | ![Ask Codex showing compact context, a typed plan, and approval](./docs/images/kyro-live-codex-plan.png) |

## Why I built Kyro

Visual builders are welcoming until the product needs real behavior. Code agents are powerful, but they usually meet a repository before they understand what the user selected, what that component means, or which flows and data depend on it.

Kyro closes that gap. The interface is not a mock-up placed in front of the program: **it is the entry point to the program**.

1. Draw the interface with familiar direct manipulation.
2. Select an element and see its actions, bindings, dependencies, and errors.
3. Connect behavior through reusable Node-RED-style flows.
4. Ask Codex for the difficult part without copying a selector or explaining the whole repository.
5. Review the plan, apply one verified transaction, inspect Preview, and undo it atomically.
6. Export readable code that keeps working outside Kyro.

The goal is not to replace the user with AI. It is to let a visual thinker keep ownership of the product while Codex handles complexity at the exact point where it appears.

## What makes Kyro different

- **Graph-native, not prompt-native.** Design, state, flows, data, services, permissions, and provenance share stable IDs in one source of truth.
- **Real contextual Codex.** Ask Codex always calls authenticated Codex; Kyro skills and typed tools guide it but never replace the model with a scripted answer.
- **Capability Resolver as an adviser.** If a feature needs storage, a backend, a provider, credentials, permissions, or a package, Kyro explains the missing pieces to Codex and keeps activation behind review.
- **Safe self-extension.** An unsupported request can become a global, versioned capability draft with typed inputs, outputs, permissions, dependencies, tests, and an activation gate. It is never presented as working before implementation and verification.
- **Manual and AI parity.** A manual edit and a Codex edit pass through the same Core, Transaction Engine, Verification pipeline, Runtime, Preview, and Export.
- **No lock-in.** Projects are local and versionable. Web/PWA exports are readable TypeScript/Vite; Android exports use Capacitor and can be built independently.
- **Codex remains optional.** Design, data, actions, flow debugging, Preview, and Publish remain usable without AI.

| Reusable visual behavior | Visual data and bindings |
| --- | --- |
| ![Node-RED-style flow with validation and success/error branches](./docs/images/kyro-visual-flow.png) | ![Local data source, schema, and visual bindings](./docs/images/kyro-data-model.png) |

## Measured: Kyro versus Codex CLI in PowerShell

The release benchmark starts with one minimal project built visually in Kyro, exports it, and creates two byte-identical copies. Ten cumulative prompts are then sent in the same order:

- **Kyro path:** Ask Codex receives the live selection, stable IDs, compact Graph slice, linked flows and data, typed operation contracts, and current revision. Every change requires approval, a transaction, and Preview verification.
- **PowerShell path:** Codex CLI starts inside the exported project folder in a fresh ephemeral session for every prompt, without the Live Bridge or active visual selection.

The prompt set covers styling, responsive layout, validation, schema evolution, CRUD flows, dependency repair, flow refactoring, accessibility, a missing PDF capability, and a filtered dashboard export.

| Ten identical cumulative prompts | Kyro | Codex CLI |
| --- | ---: | ---: |
| Functionally accepted | **10/10** | **0/10** |
| Process exit reported success | 10/10 | 10/10 |
| Median wall time per turn | 44.8 s | **27.0 s** |
| Total wall time | 509.5 s | **274.7 s** |
| Median tokens per turn | **79.0k** | 82.2k |
| Total tokens | 784.3k | **763.6k** |
| Output project | Changed and independently verified | Byte-identical to baseline |

![Ten-prompt Kyro and Codex CLI benchmark](./docs/images/kyro-vs-codex-cli-10.svg)

This result is deliberately not presented as a latency or token win. Codex CLI was faster and used slightly fewer total tokens, but all ten turns explained that they could not safely target the active Kyro component or apply a verified Graph transaction. Exit code zero meant “the agent answered,” not “the task worked.” The CLI output tree retained the baseline SHA-256; Kyro produced a different verified tree and completed the workflow.

Kyro's final checkpoint was then tested as a real user in a headed browser: invalid submit and focus recovery, optional due date, filters, empty state, desktop/mobile layout, persistence after reload, export, clean install, production build, and independent runtime. Console and runtime errors were zero.

| Headed Kyro Preview | Mobile breakpoint |
| --- | --- |
| ![Final benchmark project running in Kyro Preview](./docs/images/kyro-benchmark-10-desktop.png) | ![Final benchmark project at the mobile breakpoint](./docs/images/kyro-benchmark-10-mobile.png) |

This is a local product-context benchmark, not a universal claim about Codex CLI. The prompts intentionally depend on live visual selection and Graph context because that is the feature under test. The repository publishes the [protocol](./docs/benchmarks/kyro-vs-codex-cli-10-prompts.json), [scored result](./docs/benchmarks/2026-07-21-kyro-vs-codex-cli-10-results.json), [raw Kyro run](./docs/benchmarks/2026-07-21-kyro-10-raw.json), [raw CLI run](./docs/benchmarks/2026-07-21-codex-cli-10-raw.json), and both runners: [`benchmark-kyro-vs-cli-10.mjs`](./scripts/benchmark-kyro-vs-cli-10.mjs) and [`benchmark-codex-cli-10.ps1`](./scripts/benchmark-codex-cli-10.ps1).

## Install in one command

The CLI is designed for **Windows, macOS, and Linux** with Node.js 20+, npm, Git, and a Chromium-based browser. The v2.1.0 release installation below was freshly verified on Windows; the repository CI verifies the portable Node/Vite path.

```bash
npm install -g https://github.com/Musca420/kyro-visual-low-code-studio/releases/download/v2.1.0/kyro-studio-2.1.0.tgz
kyro --home
```

Then:

- run `kyro` inside an existing project folder to import and open it;
- run `kyro` elsewhere to open Home and create or import visually;
- run `kyro path/to/project` to choose a folder explicitly;
- run `kyro --check` to inspect what Kyro would open without starting it.

Kyro binds only to `127.0.0.1`, and project state stays in local IndexedDB. A complete Android build additionally requires Java 21 and the Android SDK. The supported install is the cross-platform `kyro` CLI; the discontinued unsigned desktop installer is not distributed.

![Kyro 2.1.0 running from a clean CLI installation](./docs/images/kyro-2.1-fresh-install.png)

### Build from source

```bash
git clone https://github.com/Musca420/kyro-visual-low-code-studio.git
cd kyro-visual-low-code-studio
npm ci
npm run check
npm link
kyro --home
```

## Five-minute judge path

1. Start `kyro --home` and create a blank project or import a folder.
2. Add a page, drag components onto the canvas, resize and nest them, then switch Desktop, Tablet, and Mobile.
3. Select a component, open **Actions**, choose an event, and connect visual nodes in **Flow**.
4. Right-click the component, choose **Ask Codex**, inspect the captured context and typed plan, then approve and undo once.
5. Add a local IndexedDB source, bind a form or list, and exercise success, validation, empty, loading, and error states.
6. Open **Preview**, then **Publish** a Web/PWA or Android export.

Judges can test generated outputs without rebuilding Kyro from the [NexusField demo release](https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v0.1.15), which includes an independent Web/PWA export, Android APK, test evidence, and demo assets.

| Publish an independent Web/PWA | Verify the generated Android app |
| --- | --- |
| ![Publish panel configuring Web and PWA export](./docs/images/kyro-publish-web.png) | <img src="./docs/images/kyro-android-device.png" alt="Generated Android app running on a physical device" width="280"> |

## How Codex and GPT‑5.6 were used

Codex with GPT‑5.6 was both the main engineering collaborator during Build Week and the reasoning engine embedded behind Ask Codex.

The human decisions shaped the product: visual-first interaction, Canva-like direct manipulation, a single open Graph, local-first storage, explicit approval for capabilities and dependencies, generic fixes instead of demo-specific shortcuts, and exports that remain useful outside Kyro. Development happened as repeated goal loops: define a verifiable outcome, implement the smallest vertical slice, run tests, use the product visually, correct the root cause, and capture evidence.

Codex accelerated repository analysis, architecture work, implementation, test generation, visual browser verification, Android deployment, security review, benchmark design, and release documentation. Inside Kyro, GPT‑5.6 receives only the relevant project brief, page, selected stable component, semantic intent, nearby dependencies, linked flows and data, runtime errors, revision, and available typed operations. Planning is read-only; approved mutations pass through the same Transaction Engine and Verification used by manual edits.

The main Build Week session ID and safe session metadata are documented in [`CODEX_SESSION_EVIDENCE.md`](./CODEX_SESSION_EVIDENCE.md). No credentials, account tokens, or private conversation transcript are committed.

## Build Week boundary

Kyro began as a pre-existing local visual-editor prototype. Commit [`38a72eb`](https://github.com/Musca420/kyro-visual-low-code-studio/commit/38a72eb3467d28371a9c3d0894753a3c2bcf9321) is the imported baseline dated **18 July 2026**. The dated commits after that point are the Build Week extension: unified graph context, stable contextual selection, Live Bridge, Codex transactions and undo, visual flows, data bindings and generated backend, native capability nodes, folder import, CLI, Web/PWA/Android export, security boundaries, and real browser/device verification.

See [`HACKATHON_COMPLIANCE.md`](./HACKATHON_COMPLIANCE.md) for the submission audit and the [official rules](https://openai.devpost.com/rules) for the authoritative requirements.

## Verification

```bash
npm run check
npm run test:e2e

npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated
```

Current release evidence records **241 unit/integration tests passed** and **55 standard Playwright scenarios passed** on the prepared release workstation. A clean CI runner can explicitly gate three environment-dependent scenarios: the full Android build, reimport of that generated Android source, and already-running specialized exports. The same release run completed the headed ten-prompt workflow, independent Web export installation/build/runtime verification, and fresh installed-CLI acceptance. The dedicated headed Android scenario also passed: Kyro generated a project through Publish, installed only reviewed dependencies, built the web bundle, added and synced Capacitor 8, ran Gradle `assembleDebug`, produced a 4,144,292-byte APK, and verified manifest permissions, version, orientation, keyboard behavior, theme resources, and the final UI status.

![Kyro completing the independently verified Android debug build](./docs/images/kyro-android-build-verified.png)

The reproducible manifest and proof bundle are in [`release/kyro-2.1.0-evidence.zip`](./release/kyro-2.1.0-evidence.zip). Additional reports: [`NEXUSFIELD_VALIDATION_REPORT.md`](./NEXUSFIELD_VALIDATION_REPORT.md), [`CHANGELOG.md`](./CHANGELOG.md), and [`ROLLBACK.md`](./ROLLBACK.md).

## Architecture in one minute

```text
Visual Editor ─┐
Ask Codex ─────┼─> typed operation ─> Transaction Engine ─> Verification ─> Graph revision
Manual Flow ───┘                                                        │
                                              Runtime <─ Preview <─ Export
```

- `src/model.ts` — validated, versioned unified Graph.
- `src/projectCore.ts` and `src/transactionEngine.ts` — authority, atomic mutations, revision, audit, rollback.
- `src/flow.ts` — deterministic visual-flow runtime and traces.
- `src/PreviewFrame.tsx` — sandboxed interactive Preview using the shared Runtime.
- `src/generator.ts` — readable Web/PWA/Android generation and local backend.
- `src/CodexPanel.tsx` — context, plan, approval, evidence, history, and undo.
- `server/kyroMcp.mjs` — allow-listed typed tools for contextual Codex work.
- `.agents/skills/` — focused design, app, data, actions, native, extension, test, and publish workflows.

External providers, secrets, dependency installation, signing, paid services, and store publication remain behind explicit approval. Imported source is analyzed but never executed automatically.

## License and submission material

- [MIT License](./LICENSE)
- [Devpost submission copy](./DEVPOST_SUBMISSION.md)
- [Codex session evidence](./CODEX_SESSION_EVIDENCE.md)
- [OpenAI Build Week compliance](./HACKATHON_COMPLIANCE.md)

Copyright © 2026 Kyro contributors.
