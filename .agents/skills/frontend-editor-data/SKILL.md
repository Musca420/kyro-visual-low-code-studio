---
name: frontend-editor-data
description: Model and connect Frontend Editor data sources, schemas, relations, bindings, local IndexedDB, generated backends and REST APIs; create CRUD, search, filter, sort, KPI, loading, empty and error behavior. Use for persistence, records, forms, authentication data or external services.
---

# Frontend Editor Data

1. Inspect sources, bindings and flows before proposing storage.
2. Use IndexedDB for local-first/offline data, generated backend for server requirements, REST only when an endpoint exists.
3. Never put secrets in the project graph; use declared environment keys.
4. Build schema, bindings and CRUD flows in one transaction when safe.
5. Verify creation through the exported/preview application, not by inserting records directly.

Use `$frontend-editor-live` and the shared invocation script. Read [references/data-tools.md](references/data-tools.md).
