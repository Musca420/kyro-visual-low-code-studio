# Extension approval contract

Approval records contain exact package name, version range, capability reason and timestamp. Kyro accepts only scoped package names and versions already derived from a native action in the visual graph.

`approve_dependency` and `revoke_dependency` require `confirmed=true`. Removing the action removes the dependency request; revoking approval removes the package from future exports. Installation happens during export/build in an isolated folder. The agent must report registry/source provenance, permissions, build result and residual platform risk.
