---
name: frontend-editor-live
description: Inspect and modify live Frontend Editor projects using the active canvas, selected components, structured IDs, layouts, styles, flow nodes, bindings, data sources and preview state. Use when Codex is asked to understand, move, resize, style, connect, debug or add behavior or data to an element, or compare the editor, preview and exported app.
---

# Frontend Editor Live

Treat the visual project model as the source of truth. Never guess the target from prose or edit generated UI code for a change representable in the editor.

## Required workflow

1. From the repository root, run `node .agents/skills/frontend-editor-live/scripts/check_live_bridge.mjs`; stop clearly if the editor or bridge is unavailable.
2. Read `GET http://127.0.0.1:4173/api/live/status`. Record `projectId`, `pageId`, `revision`, selection and viewport.
3. Inspect the selected component, its neighbors, flows and data sources. Read [references/project-model.md](references/project-model.md) only when changing the model.
4. For visual work, capture the canvas before changing it and identify the target by stable ID, not appearance alone.
5. For behavior or data work, inspect linked flows and sources. If a required source is missing, offer a local source or an existing connection and wait for confirmation.
6. Present a short plan before a substantial change. Call only typed bridge operations from [references/live-bridge-tools.md](references/live-bridge-tools.md).
7. Send the revision read in step 2 with every mutation. On `409`, fetch fresh state and reassess; never retry a stale write blindly.
8. Apply related changes as one transaction. Validate the model, refresh preview, inspect runtime and console errors, and capture the result.
9. Verify desktop and mobile for visual work. Do not claim success without observing the updated preview.
10. Report changed components, flow/data changes, tests and the transaction ID available for undo.

## Guardrails

- Read operations may run automatically. Deletion, dependency installation, external services and infrastructure require explicit approval.
- Never send secrets, tokens or arbitrary shell commands through the visual bridge.
- Prefer Flex/Grid structure over fragile coordinates. Preserve stable IDs.
- Use protected extension modules only for behavior the visual model cannot represent; declare typed inputs/outputs and tests.
- Read [references/security.md](references/security.md) before destructive, external or code-extension work.
- Follow [references/visual-workflows.md](references/visual-workflows.md) for layout, responsive and data/flow verification.
