# Compact context contract

Request only these slices unless a capability gap requires more:

- project ID, name, revision, target and app settings;
- active page ID/path and viewport;
- selection ID/type/name, semantic intent and bounds;
- parent, children and nearby siblings by stable ID;
- event-to-flow links and the linked nodes/edges;
- data binding, schema and provider for referenced sources;
- validation issues, runtime logs and last preview evidence;
- exact external extension requests and approval state.

Mutations use typed editor operations and the revision captured by the read. A successful transaction must return changed IDs, final revision and an undo ID.
