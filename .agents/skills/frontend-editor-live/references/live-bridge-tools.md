# Live Bridge tools

Base URL predefinito: `http://127.0.0.1:4173`. Tutte le risposte sono JSON e `no-store`.

## Stato live

- `GET /api/live/status`: progetto/pagina attivi, revision, selezione, viewport, preview, albero componenti, flow, sorgenti ed errori.
- `POST /api/live/state`: usato dall’editor per sincronizzare lo stato; non usarlo per simulare selezioni o progetti.

## Tool tipizzati

Invocare con `POST /api/live/tools/<nome>` e JSON `{projectId,pageId,revision,args}`. Le letture restituiscono subito il risultato; le mutazioni restituiscono `202` e `transactionId`. Controllare l’esito con `GET /api/live/transactions/<id>`.

Letture: `get_editor_status`, `get_active_project`, `get_active_page`, `get_current_selection`, `get_component`, `get_component_tree`, `get_component_layout`, `get_computed_styles`, `get_page_flows`, `get_component_flows`, `get_data_sources`, `get_runtime_state`, `get_validation_errors`, `get_console_errors`, `validate_project`.

Operazioni asincrone: `move_component`, `resize_component`, `set_component_property`, `set_component_style`, `set_responsive_style`, `add_component`, `remove_component`, `reorder_component`, `create_flow`, `connect_nodes`, `bind_component_data`, `create_data_source`, `apply_editor_transaction`, `undo_last_transaction`, `open_preview`, `capture_canvas`, `capture_preview`. Le catture restituiscono `{dataUrl,width,height}` nel campo `result` della transazione e non cambiano la revisione.

Dal root del repository usare `node .agents/skills/frontend-editor-live/scripts/invoke_live_tool.mjs <tool> '<args-json>'`. Lo script legge automaticamente progetto, pagina e revisione correnti. `remove_component` richiede `confirmed:true`.

## Sessione Codex

- `GET /api/codex/status`: stato del login ufficiale e workspace vincolato.
- `POST /api/codex/run`: `{mode:"plan"|"apply",prompt,context,projectId,revision}`. `plan` usa sandbox read-only; `apply` usa workspace-write. Una revisione obsoleta restituisce `409`.
- `POST /api/codex/cancel`: termina l’operazione corrente.

Non esiste un endpoint shell generico. Le gerarchie annidate sono restituite da `get_component_tree`; usa `move_component` con `parentId`, `add_component` con `parentId` o `wrap_component` per modificarle. Il bridge rifiuta contenitori non validi e cicli.
