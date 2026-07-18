# Stato MVP e prove

## Definition of Done

| Requisito | Implementazione | Prova riproducibile |
|---|---|---|
| Installazione/avvio | Vite, comandi documentati | `npm install`, `npm run dev` |
| Typecheck/lint/build | TypeScript strict, ESLint | `npm run typecheck`, `npm run lint`, `npm run build` |
| Test principali | modello, migrazione, riferimenti, runtime, generatore | `npm test` |
| Playwright vertical slice | builder→dati→flow→preview→persistenza→ZIP | `npm run test:e2e` |
| Progetto/pagina/componenti | CRUD dashboard, autosave, pagina, DnD/palette | E2E `vertical-slice.spec.ts` |
| Canvas/pannelli | selezione multipla, ordine, duplica/elimina, dimensione/posizione, zoom | E2E + verifica UI |
| Responsive/stili | desktop/tablet/mobile nel modello, preview ed export | E2E modifica desktop/mobile; test generatore |
| Eventi/flow | evento click collegato a grafo modificabile | E2E + flow editor React Flow |
| Runtime success/error | esecuzione deterministica, log, timeout/cancel/loop guard | `tests/flow.test.ts` + E2E errore input vuoto |
| Provider locale | IndexedDB per progetto, record e plugin | E2E editor ed export indipendente |
| Preview/diagnostica | iframe sandbox, loading/empty/error, console nodi | E2E vertical slice |
| Import/export progetto | JSON validato e deterministico | unit test modello + controlli dashboard |
| App indipendente | ZIP Vite/TS, install/build/start e CRUD | `npm run export:sample`, build e `npm run test:generated` |
| Plugin manager | install/enable/disable/remove, collisioni e manifest Zod | secondo test Playwright |
| Capacitor | config generata e istruzioni | `capacitor.config.ts` nell'export; limite JDK/adb documentato |
| Sicurezza/a11y | niente segreti, iframe sandbox, DOM textContent, focus/label/semantic HTML | review sorgenti + E2E controlli accessibili |

## Vertical slice obbligatorio

Il test `e2e/vertical-slice.spec.ts` crea un progetto vuoto e una pagina, trascina input/pulsante/lista, modifica larghezza/posizione a breakpoint diversi, crea la sorgente IndexedDB e il flow grafico, inserisce un record, verifica lista e log, prova l'errore su input vuoto, attende autosave, chiude/riapre e verifica il record, esporta e reimporta il JSON, quindi scarica e ispeziona lo ZIP.

L'app esportata viene inoltre materializzata in `generated-app`, installata e compilata separatamente; `e2e-generated/generated-app.spec.ts` la avvia su una porta distinta e verifica un inserimento nel suo IndexedDB.

## Stato Git iniziale

La directory iniziale conteneva esclusivamente `PROJECT_SPEC.md` e non era un repository Git. Non sono quindi esistite modifiche Git pregresse da sovrascrivere e non sono state usate operazioni Git distruttive.
