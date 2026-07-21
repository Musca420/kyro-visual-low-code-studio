# Kyro — Devpost submission draft

## Tagline

Design visually. Program through a graph. Give Codex the exact context it needs.

## Track

Developer Tools.

## Inspiration

Visual builders make design approachable but often hide logic, lock users into a platform, or force an AI agent to rediscover a large codebase. Kyro starts from the interface: every visual element can expose intent, events, data, services, native capabilities, and generated files in one graph.

## What it does

Kyro is a local-first visual low-code studio for Web, PWA, and Android applications. Users drag, resize, nest, style, animate, and make responsive components on a Canva-like canvas. The same components appear as event sources in a Node-RED-style flow editor for navigation, state, conditions, forms, CRUD, APIs, validation, permissions, and native actions.

**Ask Codex** is available directly on a component. Kyro sends a compact live context with stable IDs, screenshot, hierarchy, semantic intent, connected flows, data sources, runtime errors, revision, and generated files. Codex proposes a typed transaction, Kyro previews and validates it, and the user can undo it as one operation. A Capability Resolver explains missing databases, backends, providers, packages, credentials, costs, and safer alternatives in plain English.

Projects use an open versioned graph and export readable TypeScript/Vite, installable PWAs, and Capacitor Android projects. Users can continue outside Kyro without vendor lock-in.

## How we built it

Kyro uses React, TypeScript, Vite, IndexedDB, Playwright, a local Live Bridge, and Capacitor. Codex with GPT-5.6 was the primary engineering and verification collaborator. The main Codex Session ID is `019f7465-48aa-78e3-8531-1e4b6342b31e`.

We also ran ten cumulative prompts against byte-identical exported projects: once through Ask Codex in Kyro and once through Codex CLI in PowerShell. Kyro completed and verified 10/10 changes. CLI returned exit code zero for every turn but applied 0/10 because it had no active visual selection, Live Bridge, or authorized Graph transaction; its output tree remained byte-identical to the baseline. CLI was faster (27.0 s versus 44.8 s median) and total token use was similar (763.6k versus 784.3k), so we do not claim a latency or token win. We claim verified contextual execution. The repository includes the exact prompts, raw records, hash evidence, screenshots, limitations, and both runners.

We validated the system by creating two separate visual projects entirely through Kyro: NexusField Web and NexusField Mobile. They model a multi-role marketplace with 17 screens, local/generated data, authentication, reusable flows, protected mutations, payment/refund actions, signature, offline behavior, and native Android capabilities. The exported PWA and APK were built and run independently and share the same local backend during the final test.

## What changed during Build Week

Kyro existed as an early local visual-editor prototype. The imported baseline commit dated 18 July 2026 marks the judging boundary. Work after that point added and substantially extended the unified program graph, stable contextual selection, Live Bridge, embedded Codex transactions/undo, Capability Resolver, reusable Node-RED-style flows, data bindings and generated backend, native capability nodes, project-folder import, repository-first CLI, Web/PWA/Android export, and real browser/device validation.

## Testing instructions

1. Install Node.js 20+.
2. Run `npm install -g https://github.com/Musca420/kyro-visual-low-code-studio/releases/download/v2.1.0/kyro-studio-2.1.0.tgz`.
3. Run `kyro --home`.
4. Create a project or import a folder.
5. Add a page and components, style them, then use Actions or Ask Codex.
6. Open Preview and Publish to export Web/PWA or prepare Android.

For a no-rebuild evaluation, download the Web/PWA ZIP or Android debug APK from the public GitHub Release. The release also contains the Playwright trace and narrated demo.

## Challenges

The hardest problem was keeping design, flow, data, native capabilities, Codex context, preview, and generated code synchronized without creating separate sources of truth. Real-device testing uncovered reusable generator defects in loopback CORS, Android cleartext development access, and authentication persistence; each was fixed globally and covered by tests.

## Accomplishments

- A visual graph that connects component intent to events, data, services, native capabilities, and files.
- Component-level Ask Codex without copying selectors or scanning the whole repository.
- Atomic, revision-aware, undoable agent changes.
- Readable independent Web/PWA and Android output.
- Real headed Playwright and physical Android verification with shared data.

## What's next

Production signing and store distribution, hosted collaboration, additional reviewed provider plugins, and production push-notification providers. These remain explicit integrations rather than hidden platform dependencies.

## Links to complete in Devpost

- Source: https://github.com/Musca420/kyro-visual-low-code-studio
- Public test build: https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v2.1.0
- Public YouTube demo: add the recorded voice to `Kyro-Hackathon-Demo-2m47-Silent.mp4`, upload the final video, and paste the URL
- Codex feedback session: `019f7465-48aa-78e3-8531-1e4b6342b31e`
