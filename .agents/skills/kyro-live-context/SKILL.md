---
name: kyro-live-context
description: "Inspect the active Kyro visual project through its compact graph context: current page, selection, component intent, linked actions, data, runtime errors and revision. Use before any agent change inside Kyro so work targets stable IDs without scanning the repository."
---

# Kyro Live Context

Use the visual graph as the source of truth.

1. Read compact project status, active page, selected component and current revision through the live bridge.
2. Inspect only the selected component's dependency slice: ancestors, children, events, flows, bindings, capabilities, runtime errors and generated files.
3. Resolve targets by stable IDs. Never infer an element from screen position when an ID is available.
4. Choose the smallest matching Kyro skill: design/data for appearance or binding, `$kyro-actions` for behavior, `$kyro-native` for device functions, `$kyro-extensions` only when visual nodes cannot represent the request.
5. Send the observed revision with every mutation. On conflict, reload context and reassess.
6. Apply related operations as one transaction, validate, run preview and record the undo transaction.

Do not inspect unrelated repository files, edit generated output, or use browser automation to mutate the visual graph. Read [references/context-contract.md](references/context-contract.md) for the bounded payload.
