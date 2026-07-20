# Extension approval contract

Approval records contain exact package name, version range, capability reason and timestamp. Kyro accepts only scoped package names and versions already derived from a native action in the visual graph.

`approve_dependency` and `revoke_dependency` require `confirmed=true`. Removing the action removes the dependency request; revoking approval removes the package from future exports. Installation happens during export/build in an isolated folder. The agent must report registry/source provenance, permissions, build result and residual platform risk.

## Learning lifecycle

1. Complete the user request through Codex and the smallest approved transaction.
2. Validate typed outputs, graph revision, runtime behavior and preview.
3. Generalize the successful intent into a reusable flow, typed module or plugin candidate.
4. Strip stable IDs and app-specific values; declare inputs, outputs, errors and platform requirements.
5. Keep the candidate inactive until tests pass. Require explicit review for executable code, packages, permissions or credentials.
6. Record provenance from the source transaction and make promotion and removal auditable.

Capability proposals and learned capabilities are installation-wide Kyro resources. Projects store only a versioned reference when they use one. `kyro_register_global_capability` may create an inactive draft after approval; it may not install dependencies, activate executable code, or claim the requested behavior works. Activation requires the declared tests, and external code additionally requires explicit review.

A failed attempt is evidence, not a reusable capability. Never promote it automatically.
