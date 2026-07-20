# Kyro — Visual Low-Code Studio

Kyro is an open, local-first visual programming studio for people who think in layouts before code. It combines a Canva-like canvas, a Node-RED-style flow editor, visual data modeling, native device capabilities, and an embedded Codex agent. The visual graph remains the source of truth and exports readable TypeScript/Vite, PWA, and Capacitor Android projects without vendor lock-in.

Built for the OpenAI Build Week 2026 Developer Tools track. Kyro was extended during the submission period with the unified graph, Live Bridge, contextual Codex transactions, native capability nodes, independent exports, and the NexusField Web/Android validation described in [Hackathon compliance](./HACKATHON_COMPLIANCE.md) and [NexusField validation](./NEXUSFIELD_VALIDATION_REPORT.md).

## Start in one command

Requirements: Node.js 20+ and a Chromium-based browser.

```bash
git clone https://github.com/Musca420/kyro-visual-low-code-studio.git
cd kyro-visual-low-code-studio
npm install
npm link
kyro
```

Run `kyro` inside an existing project folder to import it. Run it elsewhere to open Home and create or import a project visually. Use `kyro "path/to/project"` for an explicit folder or `kyro --home` to force Home. The server binds only to `127.0.0.1`; project data stays in local IndexedDB.

Supported editor hosts: Windows, macOS, and Linux with Node.js. Generated Web/PWA projects are self-hostable; Android export requires the Android SDK. Unsigned desktop packaging is available for development, while the repository-first CLI avoids operating-system signing warnings for judges.

## What judges can test

- Build pages with drag-and-drop, nested layers, reusable blocks, direct resize, snapping, responsive breakpoints, styles, states, animation, light/dark themes, and WCAG-oriented controls.
- Select a component and open **Actions** to connect click, input, submit, page, timer, permission, data, API, UI, condition, loop, and reusable-flow nodes.
- Right-click a component and choose **Ask Codex**. Kyro sends the compact graph slice, stable IDs, screenshot, linked flows/data, runtime errors, and revision; changes are previewed, validated, recorded, and undoable.
- Create IndexedDB or generated local REST data, bind forms/lists/KPIs, and exercise CRUD, search, filter, sort, validation, loading, empty, and error states.
- Configure camera, location, QR/barcode, local notifications, deep links, files, sharing, haptics, network, and platform conditions through visual nodes.
- Export a standalone Web/PWA ZIP or prepare and build a Capacitor Android APK.

The public GitHub Release contains an APK, Web/PWA ZIP, trace, and the narrated demo so judges can test without rebuilding the generated projects.

## Codex and GPT-5.6

Codex was the primary development and verification agent and is also embedded in Kyro. The main Build Week session used `gpt-5.6-sol`; safe session metadata is recorded in [Codex session evidence](./CODEX_SESSION_EVIDENCE.md). Product decisions remained human-directed: frontend-first visual programming, an open graph format, local-first persistence, explicit capability approval, independent exports, and no access to private infrastructure.

Inside Kyro, Codex does not scan an entire repository for routine visual edits. Live Bridge supplies the current project/page/selection, semantic intent, component dependency slice, flow nodes, data bindings, runtime errors, revision, and generated-file provenance. Mutations use typed operations and atomic undoable transactions.

## Verification

```bash
npm run check
npm run test:e2e
npm run desktop:test
npm run desktop:test:packaged

npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated
```

The final live validation also builds through Kyro's visible Publish UI, runs the Web export independently, installs the generated APK with `adb install -r`, and checks authentication, shared backend mutations, offline recovery, keyboard resize, back navigation, camera, geolocation, local notifications, and persistence on a physical Android device.

## Architecture

- `src/model.ts` — versioned, validated unified visual graph.
- `src/editorOperations.ts` — typed transactional graph mutations and undo.
- `src/flow.ts` — deterministic visual-flow runtime with success/error paths and tracing.
- `src/PreviewFrame.tsx` — sandboxed interactive preview.
- `src/generator.ts` — readable Web/PWA/Android code generation and local backend.
- `src/CodexPanel.tsx` — contextual Codex session, plan, diff, approval, validation, and history.
- `vite.config.ts` — local Live Bridge scoped to the selected workspace.
- `.agents/skills/` — Kyro-specific agent skills for context, design, data, actions, native capabilities, extensions, testing, and publishing.

Plugin contributions are declarative and validated; imported source is never executed during analysis. External providers, credentials, release signing, store publication, and paid services require explicit user approval.

## Evidence and licensing

- [NexusField Mobile/Web matrix and final test report](./NEXUSFIELD_VALIDATION_REPORT.md)
- [OpenAI Build Week compliance](./HACKATHON_COMPLIANCE.md)
- [Devpost submission copy](./DEVPOST_SUBMISSION.md)
- [Original binding validation plan](./final_plan.md)
- [MIT License](./LICENSE)

Copyright © 2026 Kyro contributors. Released under MIT.
