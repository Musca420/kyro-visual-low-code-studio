---
name: kyro-data
description: Model and connect Kyro data sources, schemas, bindings and CRUD flows. Use for local persistence, generated backends, REST services, forms, search, filter, sort, KPI, loading, empty, error and authentication data.
---

# Kyro Data

1. Inspect existing sources, bindings, flows and component intent through `$kyro-live-context`.
2. Reuse a compatible source. Otherwise call the capability resolver and prefer IndexedDB for local-first data.
3. Define an explicit schema and connect reads and writes with `$kyro-actions`.
4. Add validation before writes and visible loading, empty, success and error states.
5. Keep credentials out of the client; declare environment keys and require a backend for secrets.
6. Apply schema, binding and flow changes atomically, then verify CRUD and persistence in preview.
7. Never insert demonstration records by bypassing the application's own preview UI.
