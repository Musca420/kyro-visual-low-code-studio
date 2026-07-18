# Sessioni persona “Canva, zero coding”

Data: 18 luglio 2026. Queste sono sessioni **simulate e automatizzate nel browser**, non interviste con persone reali. Ogni azione di progetto passa dai controlli disponibili nell'interfaccia; non vengono inseriti componenti o record modificando direttamente IndexedDB o il JSON. I tempi misurano l'automazione e servono per confrontare regressioni, non rappresentano il tempo umano.

| Persona simulata | Obiettivo visuale | Prova riproducibile | Esito | Tempo ultima sessione |
|---|---|---|---|---:|
| Brand designer | Rifinire una landing con palette, gradienti, font, allineamento, angoli, ombre e animazioni senza CSS | `e2e/canva-user.spec.ts` | Completato | 3,1 s |
| Canva power user | Creare colonne responsive, drag, resize, riquadro di selezione, allineamento, distribuzione e snapping con preview/export | `e2e/canva-canvas.spec.ts` | 3/3 task completati | 12,9 s |
| Proprietaria di app esistente | Importare una cartella Android/Web, modificare visualmente, vedere la preview ed esportare senza perdere i file originali | `e2e/folder-import.spec.ts` | Completato | 3,9 s |
| Web designer | Creare un sito professionale multipagina con contenuti, form, dati e flow dalla UI | `e2e/rich-website.spec.ts` | Completato | 4,1 s |
| Product manager | Creare landing e dashboard complessa, usare CRUD, ricerca, filtro, KPI, validazione e cinque record dalla preview | `e2e/scenarios.spec.ts` | Completato | 6,8 s |

Comando congiunto: `npx playwright test e2e/canva-user.spec.ts e2e/canva-canvas.spec.ts e2e/rich-website.spec.ts e2e/scenarios.spec.ts e2e/folder-import.spec.ts --workers=1` — 7 test superati in 32,1 s.

## Problemi osservati e riprovati

- Il primo elemento annidato intercettava i drop successivi: il layout del contenitore viene ora applicato alla drop-zone tecnica; tre card in tre colonne sono riprovate da zero.
- `position: static` spostava le maniglie fuori viewport: la cornice tecnica mantiene un containing block senza cambiare lo stile esportato.
- I margini causavano reflow e rendevano falso l'allineamento multiplo: l'allineamento libero materializza coordinate coerenti in editor, preview ed export.
- Il click generato dopo un drag annullava la multiselezione: la manipolazione diretta conserva ora il gruppo.
- Le transizioni facevano inseguire il puntatore agli elementi: durante drag/resize sono sospese e poi ripristinate.
- I tooltip coprivano guide e oggetti durante il trascinamento: vengono nascosti mentre il puntatore è premuto.
- Le etichette “Larghezza/Altezza” collidevano con le maniglie per tecnologie assistive: i controlli hanno nomi univoci.
- Un nodo plugin senza flow produceva un vicolo cieco: il percorso verificato è ora provider → sorgente → flow → nodo, con messaggio comprensibile se manca il prerequisito.

## Limite aperto

La prova automatizzata dimostra ripetibilità tecnica e percorsi zero-coding, ma non sostituisce cinque sessioni con persone reali. Reclutamento, consenso e osservazione umana richiedono coordinamento esterno; restano quindi un'attività di validazione prodotto, non un requisito dichiarabile come già eseguito in questo ambiente.
