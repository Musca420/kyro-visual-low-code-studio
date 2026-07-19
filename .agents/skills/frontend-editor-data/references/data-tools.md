# Data operations

- `create_data_source {name,provider,collection,schema,endpoint?,environmentKey?}`.
- `update_data_source {sourceId,patch}` and `remove_data_source {sourceId,confirmed:true}`.
- `bind_component_data {componentId,sourceId,state}` where state is data, loading, empty or error.
- Use flow nodes query, insert, update, delete, filter, sort, map, kpi and refresh.

Schemas require `id` and use string, number, boolean or datetime fields. Preserve schema migrations and relations. Handle loading, empty, success and error visibly.
