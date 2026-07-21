# OpenAI Build Week compliance

Kyro targets the **Developer Tools** track of OpenAI Build Week. This checklist follows the [official rules](https://openai.devpost.com/rules), last reviewed on 21 July 2026.

## Required submission material

- [x] Public source repository with an MIT license.
- [x] English installation and testing entry point in `README.md`.
- [x] Dated Git history distinguishing pre-existing work from Build Week extensions.
- [x] Public working demo and unrestricted Web/PWA and Android test builds published in the [v0.1.15 GitHub Release](https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v0.1.15).
- [ ] Public YouTube demonstration with audio, shorter than three minutes.
- [x] Devpost English project description and testing instructions in `DEVPOST_SUBMISSION.md`.
- [x] `/feedback` Codex Session ID for the main project thread: `019f7465-48aa-78e3-8531-1e4b6342b31e`.
- [x] Final evidence that Codex and GPT-5.6 were used during the submission period in `CODEX_SESSION_EVIDENCE.md`.

## Existing work and Build Week extension

Kyro existed before the submission period as a local-first visual editor prototype. Commit [`38a72eb`](https://github.com/Musca420/kyro-visual-low-code-studio/commit/38a72eb3467d28371a9c3d0894753a3c2bcf9321), dated 18 July 2026, is the imported baseline snapshot and the explicit judging boundary. Subsequent dated commits add or substantially extend the unified visual program graph, contextual Codex Live Bridge, agent transactions and undo, Node-RED-style flows, local CRUD/data bindings, folder import, reusable components, Web/PWA/Android export, native capability nodes, repository-first `kyro` CLI, English-first product experience, and real browser/Android validation.

The final NexusField Web and NexusField Mobile validation, generic capability improvements discovered through those projects, demo assets, and submission packaging are tracked by `final_plan.md` and commits made during the submission period.

## Codex collaboration

Codex is used as both the development agent for Kyro and an embedded visual-project agent. Inside Kyro it receives a compact graph context containing the current page, stable component selection, semantic intent, connected flows, data sources, runtime errors, revision, and generated-file provenance. It proposes typed operations, applies an approved atomic transaction through Live Bridge, runs validation, and keeps the change undoable.

The entrant retains product and engineering decisions: frontend-first visual programming, an open versionable format, local-first storage, explicit permission/provider resolution, no private-server access, and no NexusField-specific runtime shortcuts. Codex accelerates repository analysis, root-cause fixes, test generation, visual verification, Android deployment, and release documentation.

## Judge setup

```bash
npm install -g https://github.com/Musca420/kyro-visual-low-code-studio/releases/download/v2.0.0/kyro-studio-2.0.0.tgz
kyro --home
```

Supported local judge platforms: Windows, macOS, and Linux with Node.js 20 or newer and a Chromium-based browser. The final device build was verified on Windows and a physical Android device. Generated web/PWA projects run independently on any platform supported by Node/Vite. Android export uses Capacitor and the Android SDK.

This prebuilt CLI tarball is the supported no-rebuild judge route. The unsigned Windows desktop archive was removed from the public release because asking judges to bypass operating-system trust warnings would not be a consistent installation experience. Desktop source and packaging tests remain in the repository for future signed distribution.

The public repository needs no Devpost reviewer invitation. The no-rebuild NexusField Web/PWA and Android test builds remain available from the linked release throughout judging.

## Safety and data

The validation uses only local IndexedDB, generated local backends, mock/sandbox services, browsers, and a physical Android test device. No private server, private-server address, credential, or configuration is accessed or distributed. Secrets are excluded from the visual project and source repository.

## Entrant confirmation before submission

The repository can demonstrate technical and material compliance, but it cannot prove personal eligibility. Before submitting, the entrant must personally confirm:

- [ ] age, country/region, and any employer or representative permissions meet the official rules;
- [ ] no conflict, prohibited sponsor support, or ineligible relationship applies;
- [ ] every submitted image, voice track, icon, font, and other asset is original, licensed, or permitted;
- [ ] the YouTube video is public, includes English audio, is under three minutes, and matches the tested build;
- [ ] the Devpost form includes the public repository, test instructions, video URL, and `/feedback` Session ID;
- [ ] submission is completed before **21 July 2026 at 5:00 PM PDT** (22 July 2026 at 02:00 CEST).

Entrants retain their project IP but should review the promotional license granted for submission materials in the [official rules](https://openai.devpost.com/rules). Codex-generated output can also be subject to applicable third-party or open-source licenses; Kyro therefore keeps dependencies, generated modules, and diffs inspectable.
