# Flow operations

- `create_flow {flow}` or `add_flow {name}`.
- `update_flow {flowId,name?}` and `remove_flow {flowId,confirmed:true}`.
- `add_flow_node {flowId,node}`, `update_flow_node {flowId,nodeId,patch}`, `remove_flow_node {flowId,nodeId}`.
- `connect_nodes {flowId,source,target,path}` and `remove_flow_edge {flowId,edgeId}`.
- `set_component_event {componentId,event,flowId}` collega submit, click, change o altri eventi al flow; `remove_component_event {componentId,event}` scollega.

Node types: event, readInput, validate, condition, switch, loop, getState, setState, resetState, delay, debounce, format, map, http, file, requireRole, signOut, insert, query, update, delete, filter, sort, kpi, refresh, navigate, openModal, updateUI, notify, localNotification, module and log.

`localNotification` programma un avviso di sistema con `title`, `body` e `delayMs`. In preview conferma la pianificazione; l'export web usa la Notification API e Android usa Capacitor Local Notifications chiedendo il permesso all'utente.

Use success/error edges for fallible work. Conditions use success/error; switch uses named cases and `other`; loops use `each` and `done`.
