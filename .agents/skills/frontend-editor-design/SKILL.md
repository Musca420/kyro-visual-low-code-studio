---
name: frontend-editor-design
description: Create and edit Frontend Editor pages and components through the live visual graph, including layout, hierarchy, text, assets, colors, typography, spacing, responsive styles, interaction states, animation, accessibility and semantic intent. Use for any request to draw, restyle, move, resize, group, duplicate or make a live canvas responsive.
---

# Frontend Editor Design

Use the visual project as source of truth. Never edit generated UI code.

1. Read the active selection and component tree with `$frontend-editor-live`.
2. Capture the canvas before substantial work.
3. Prefer containers, Flex and Grid over absolute coordinates.
4. Apply related operations as one `apply_editor_transaction`.
5. Validate desktop, tablet and mobile; check focus, contrast and overflow.
6. Capture the result and report the transaction ID for undo.

Use `../frontend-editor-live/scripts/invoke_live_tool.mjs`; it reads the bridge URL from `FRONTEND_EDITOR_LIVE_URL`. Read [references/design-tools.md](references/design-tools.md) for operation arguments.
