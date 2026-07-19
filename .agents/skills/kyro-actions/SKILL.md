---
name: kyro-actions
description: Create, reuse, connect and debug Kyro visual actions from a page, component and event selection. Use for taps, gestures, forms, navigation, state, conditions, data operations, feedback and reusable Node-RED-style flows.
---

# Kyro Actions

1. Use `$kyro-live-context` to identify page, component, event and existing linked flow.
2. Prefer a reusable existing flow when its typed input, output and side effects match.
3. Otherwise create one event entry node and connect explicit success/error paths.
4. Add validation before side effects, visible loading/success/error feedback, and undo where a destructive user action permits it.
5. Use visual nodes for UI, state, data, API, permissions and platform conditions. Escalate to `$kyro-extensions` only for missing behavior.
6. Apply the flow and component event link atomically.
7. Run the exact event in preview, inspect the flow trace and verify both valid and invalid branches.

Read [references/action-map.md](references/action-map.md) only when choosing events or node categories.
