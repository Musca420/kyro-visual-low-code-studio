---
name: kyro-extensions
description: Resolve a Kyro capability gap with a reviewed external package or typed custom module. Use only when registered visual nodes cannot implement the requested behavior and installation, native configuration or advanced code is required.
---

# Kyro Extensions

1. Call `kyro_resolve_capability`. Missing skill metadata never blocks a request and never authorizes a repository scan.
2. Let Codex solve the request from indexed graph context and registered MCP operations. Prefer a reusable visual flow, then a tested typed module.
3. If the current graph cannot express the request, return no fake intent-only operation. Produce one `scope: global` capability proposal with generalized intent, typed inputs and outputs, permissions, dependencies, validation tests and an activation gate.
4. After the user approves that exact proposal, call `kyro_register_global_capability`. The tool records a versioned draft in Kyro's installation-wide catalog; every project can discover it, but it is not executable yet.
5. Validate concrete implementations against the next graph revision, runtime and visual preview. Undo on failure.
6. After success, remove project names, component IDs, sample records and request-specific constants. Keep the candidate inactive until its tests pass.
7. When external code is unavoidable, present the exact package, pinned compatible version, purpose, permissions, platform impact and a no-package alternative.
8. Wait for explicit approval. Dependency approval is a typed, confirmed, revisioned operation and must match a capability requested by the current graph.
9. Install only inside the isolated generated export/build directory. Never mutate Kyro's editor dependencies for a project extension.
10. Wrap the feature in a typed action with declared inputs, outputs, errors and tests; expose it as a visible flow node.
11. Build the export, run success and error paths, record provenance and changed files, and keep both the change and approval revocable.

Do not silently rewrite a skill after one example. Promote a candidate only after a second compatible use or explicit review; otherwise preserve it as a draft recipe.

Read [references/approval-contract.md](references/approval-contract.md) before proposing or applying an extension.
