# Plugin SDK dichiarativo

Frontend Editor carica plugin locali come manifest JSON validati. Il primo SDK è intenzionalmente dichiarativo: un plugin non esegue JavaScript nell'editor e non riceve accesso a filesystem, rete, terminale, progetti o credenziali. Può soltanto fornire preset tipizzati che l'utente abilita e applica esplicitamente.

## Manifest

```json
{
  "id": "studio.focus",
  "name": "Focus tools",
  "version": "1.0.0",
  "author": "Studio",
  "compatibility": "1.x",
  "dependencies": [],
  "permissions": ["components", "flows", "data", "themes"],
  "contributions": [
    {
      "kind": "component",
      "id": "focus-card",
      "label": "Focus card",
      "componentType": "card",
      "props": { "label": "Focus card" },
      "styles": { "background": "#102a2f", "color": "#e6fffb" }
    },
    {
      "kind": "node",
      "id": "focus-notify",
      "label": "Notifica focus",
      "nodeType": "notify",
      "config": { "message": "Completato" }
    },
    {
      "kind": "provider",
      "id": "focus-api",
      "label": "Focus API",
      "endpoint": "https://api.example.test/records"
    },
    {
      "kind": "theme",
      "id": "focus-dark",
      "label": "Tema Focus",
      "tokens": { "pageBackground": "#07181c", "primary": "#22d3ee" }
    }
  ],
  "configuration": {}
}
```

Ogni contributo richiede il permesso omonimo: `component → components`, `node → flows`, `provider → data`, `theme → themes`. Installazione con ID duplicato, dipendenze mancanti, versione incompatibile, proprietà non tipizzate o permessi insufficienti viene rifiutata prima di modificare il progetto.

I componenti usano tipi nativi e proprietà visuali consentite; i nodi usano operazioni native del Flow Editor; i provider sono preset REST senza segreti; i temi modificano soltanto design token. Disabilitare il plugin rimuove i contributi dall'editor senza cancellare gli elementi già materializzati nel formato aperto del progetto. Questo evita che un export dipenda dal runtime del plugin.

## Verifica

`e2e/vertical-slice.spec.ts` installa il plugin di esempio dall'interfaccia, aggiunge una card, un nodo e una sorgente REST, applica il tema, disabilita/riabilita/rimuove il plugin e verifica che i contributi spariscano dalla palette. `tests/model.test.ts` verifica il confine permessi/contributi.
