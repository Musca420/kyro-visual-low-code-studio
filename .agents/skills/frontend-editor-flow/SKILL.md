---
name: frontend-editor-flow
description: Build, connect, inspect and debug Frontend Editor visual flows for clicks, forms, navigation, state, validation, conditions, loops, CRUD, API calls, UI updates, notifications, permissions and custom modules. Use whenever a live component must do something or application behavior must change.
---

# Frontend Editor Flow

1. Inspect selected components, existing flows and data sources through `$frontend-editor-live`.
2. Reuse a suitable flow; otherwise create one with stable node IDs.
3. Include trigger, validation, success, error and visible feedback where relevant.
4. Apply the complete flow change atomically.
5. Open preview, run valid and invalid paths, then inspect logs and console errors.

Use `../frontend-editor-live/scripts/invoke_live_tool.mjs`. Read [references/flow-tools.md](references/flow-tools.md) for node types and operations.
