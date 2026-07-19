---
name: frontend-editor-live
description: Inspect and modify live Frontend Editor projects using the active canvas, selected components, structured IDs, layouts, styles, flow nodes, bindings, data sources and preview state. Use when Codex is asked to understand, move, resize, style, connect, debug or add behavior or data to an element, or compare the editor, preview and exported app.
---

# Frontend Editor Live

Treat the visual project model as the source of truth. Never guess the target from prose or edit generated UI code for a change representable in the editor.

## Required workflow

1. Run `node .agents/skills/frontend-editor-live/scripts/check_live_bridge.mjs`; the installed app supplies `FRONTEND_EDITOR_LIVE_URL`. Stop clearly if the editor or bridge is unavailable.
2. Use the typed read tools rather than printing the full status payload. Record `projectId`, `pageId`, `revision`, selection, viewport and reported capability gaps.
3. Inspect the selected component, its semantic intent, neighbors, flows and data sources. Read [references/project-model.md](references/project-model.md) only when changing the model.
4. For visual work, identify the target by stable ID. The integrated Codex panel captures before/after evidence automatically; do not request another bridge capture from that panel.
5. For behavior or data work, inspect linked flows, sources and `capabilities`. Explain what exists and what is missing; if a required source is absent, offer local storage, an existing connection or a generated backend and wait for confirmation.
6. Present a short plan before a substantial change. Call only typed bridge operations from [references/live-bridge-tools.md](references/live-bridge-tools.md). Do not use the Browser skill to edit the editor graph.
7. Send the revision read in step 2 with every mutation. On `409`, fetch fresh state and reassess; never retry a stale write blindly.
8. Apply related changes as one transaction. Validate the model and inspect runtime errors. Let the integrated panel capture the result.
9. Verify desktop and mobile for visual work. Do not claim success without observing the updated preview.
10. Report changed components, flow/data changes, tests and the transaction ID available for undo.

## Guardrails

- Read operations may run automatically. Deletion, dependency installation, external services and infrastructure require explicit approval.
- Never send secrets, tokens or arbitrary shell commands through the visual bridge.
- Prefer Flex/Grid structure over fragile coordinates. Preserve stable IDs.
- Use protected extension modules only for behavior the visual model cannot represent; declare typed inputs/outputs and tests.
- Read [references/security.md](references/security.md) before destructive, external or code-extension work.
- Follow [references/visual-workflows.md](references/visual-workflows.md) for layout, responsive and data/flow verification.
