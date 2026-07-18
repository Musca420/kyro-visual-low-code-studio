# Live Bridge tools

Base URL predefinito: `http://127.0.0.1:4173`. Tutte le risposte sono JSON e `no-store`.

## Stato live

- `GET /api/live/status`: progetto/pagina attivi, revision, selezione, viewport, preview, albero componenti, flow, sorgenti ed errori.
- `POST /api/live/state`: usato dall’editor per sincronizzare lo stato; non usarlo per simulare selezioni o progetti.

## Sessione Codex

- `GET /api/codex/status`: stato del login ufficiale e workspace vincolato.
- `POST /api/codex/run`: `{mode:"plan"|"apply",prompt,context,projectId,revision}`. `plan` usa sandbox read-only; `apply` usa workspace-write. Una revisione obsoleta restituisce `409`.
- `POST /api/codex/cancel`: termina l’operazione corrente.

Non esiste un endpoint shell generico. Le modifiche visuali devono passare dalle operazioni strutturate disponibili nell’editor; se una capability non è esposta, segnalarla come non disponibile invece di simulare il risultato.
