---
name: kyro-extensions
description: Resolve a Kyro capability gap with a reviewed external package or typed custom module. Use only when registered visual nodes cannot implement the requested behavior and installation, native configuration or advanced code is required.
---

# Kyro Extensions

1. Prove the requested behavior is not available as an existing visual node or registered provider.
2. Present the exact package, pinned compatible version, purpose, permissions, platform impact and a no-package alternative where one exists.
3. Wait for explicit approval. Dependency approval is a typed, confirmed, revisioned operation and must match a dependency requested by the current graph.
4. Install only inside the isolated generated export/build directory. Never mutate the editor runtime dependency set for a project extension.
5. Wrap the feature in a typed action with declared inputs, output, errors and tests; expose it as a visible node in the flow.
6. Build the export, run the relevant success/error paths, record changed files and keep the approval revocable.

Read [references/approval-contract.md](references/approval-contract.md) before proposing or applying an extension.
