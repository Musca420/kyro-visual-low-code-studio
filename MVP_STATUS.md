# Stato MVP e prove

## Incremento v2 verificato

- guida hover/focus e percorso “Prossimo passo”;
- menu contestuale completo e context package con ID, revisione, bounds, stili, flow e dati;
- Live Bridge isolato per progetto con rifiuto delle revisioni obsolete;
- letture e mutazioni tipizzate, transazioni atomiche e undo con revisione monotona;
- cattura PNG reale di canvas e preview sandboxata tramite bridge;
- Codex CLI ufficiale, analisi read-only reale e approvazione prima di workspace-write;
- pannello con cronologia persistente per progetto, avanzamento reale, comandi locali, file Git, diff, test e ripristino transazionale protetto;
- ispettore visuale completo per layout, responsive, tipografia, bordi, effetti, animazioni e stati interattivi, verificato anche nell'export;
- onboarding guidato Web/PWA/Android e pannello Pubblica con configurazione visuale;
- export PWA con manifest e service worker; export Android con Capacitor 8;
- preparazione Android interamente dalla UI, rilevamento Java/SDK, sync nativo e build APK reale;
- installazione su dispositivo Android reale con verifica di avvio, tastiera, safe area, orientamento, tasto Indietro e persistenza;
- import sicuro di cartelle Web/PWA/Capacitor con ripristino esatto del modello, conversione HTML, diagnosi e sorgente originale preservata nell'export;
- grafo unificato interrogabile dal componente, intento semantico tipizzato e Capability Resolver condiviso da inspector, Live Bridge e contesto Codex;
- impatto inverso selezionabile da nodo e sorgente verso componenti, pagine, flow, capability e file generati;
- sito professionale multipagina con filtro, modal, navbar mobile, form persistente e flow visuale, creato e collaudato interamente dalla UI;
- parità editor/preview/export verificata anche per stili personalizzati e applicazioni avviate simultaneamente su porte separate;
- terminale locale persistente per progetto, con comando esplicito, output progressivo, ambiente privo di variabili-segreto e chiusura controllata;
- catalogo ricercabile con nove template completi, ricerca componenti con sinonimi e command palette `Ctrl+K`;
- procedura dati guidata per IndexedDB, API REST o backend Node generato; CRUD del backend verificato in esecuzione;
- configurazione visuale di autenticazione, ruoli, offline, SSE e variabili d'ambiente; export autenticato compilato e verificato end-to-end;
- asset manager visuale con upload immagini/audio/video, assegnazione dall'ispettore e persistenza alla riapertura;
- skill `frontend-editor-live` validata con script reali.

Prove: `e2e/guided-ux.spec.ts`, `e2e/codex-context.spec.ts`, `tests/editorOperations.test.ts`, `artifacts/guided-codex-details.png`, `artifacts/live-canvas-capture.png`, `artifacts/live-preview-capture.png`.

## Definition of Done

| Requisito                  | Implementazione                                                                                          | Prova riproducibile                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Installazione/avvio        | Vite, comandi documentati                                                                                | `npm install`, `npm run dev`                                                                                         |
| Typecheck/lint/build       | TypeScript strict, ESLint                                                                                | `npm run typecheck`, `npm run lint`, `npm run build`                                                                 |
| Test principali            | modello, migrazione, riferimenti, runtime, generatore                                                    | `npm test`                                                                                                           |
| Playwright vertical slice  | builder→dati→flow→preview→persistenza→ZIP                                                                | `npm run test:e2e`                                                                                                   |
| Progetto/pagina/componenti | CRUD dashboard, autosave, pagina, DnD/palette                                                            | E2E `vertical-slice.spec.ts`                                                                                         |
| Canvas/pannelli            | selezione multipla, ordine, duplica/elimina, dimensione/posizione, zoom                                  | E2E + verifica UI                                                                                                    |
| Responsive/stili           | desktop/tablet/mobile nel modello, preview ed export                                                     | E2E modifica desktop/mobile; test generatore                                                                         |
| Eventi/flow                | evento click collegato a grafo modificabile                                                              | E2E + flow editor React Flow                                                                                         |
| Runtime success/error      | esecuzione deterministica, log, timeout/cancel/loop guard                                                | `tests/flow.test.ts` + E2E errore input vuoto                                                                        |
| Provider locale            | IndexedDB per progetto, record e plugin                                                                  | E2E editor ed export indipendente                                                                                    |
| API e backend              | REST esistente con token da ambiente oppure server Node persistente generato                             | `e2e/data-guidance.spec.ts`, `tests/generatedBackend.test.ts`                                                        |
| Accesso e capacità app     | Registrazione/login, sessioni HMAC, ruoli, SSE, offline e requisiti mancanti guidati                     | `e2e/application-config.spec.ts`, `tests/generatedBackend.test.ts`, `tests/generator.test.ts`                        |
| Preview/diagnostica        | iframe sandbox, loading/empty/error, console nodi                                                        | E2E vertical slice                                                                                                   |
| Import/export progetto     | JSON validato e deterministico                                                                           | unit test modello + controlli dashboard                                                                              |
| App indipendente           | ZIP Vite/TS, install/build/start e CRUD                                                                  | `npm run export:sample`, build e `npm run test:generated`                                                            |
| Plugin manager             | install/enable/disable/remove, collisioni e manifest Zod                                                 | secondo test Playwright                                                                                              |
| Web/PWA/Android            | target guidati, manifest/service worker, Capacitor 8, configurazione nativa, build APK e collaudo fisico | `e2e/onboarding-targets.spec.ts`, `e2e/android-build.spec.ts`, test generatore, screenshot `artifacts/android-*.png` |
| Import progetto esistente  | Cartella sorgente, rilevamento stack, modello esatto o conversione HTML, modifica e round-trip           | `tests/folderImport.test.ts`, `e2e/folder-import.spec.ts`, screenshot `artifacts/imported-android-app.png`           |
| Test A sito ricco          | Tre pagine, stile/animazione visuale, modal, filtro, form persistente, responsive e riapertura           | `e2e/rich-website.spec.ts`, screenshot `artifacts/professional-website-*.png`                                        |
| Test B gestionale          | Cinque record creati in preview, KPI, CRUD, ricerca, filtro, validazione e mobile                        | `e2e/scenarios.spec.ts`, `e2e/application-config.spec.ts`                                                            |
| Export separati            | Tre ZIP installati, compilati e avviati sulle porte 4181-4183; grafica e comportamento confrontati       | `SCENARIO_EXPORTS=1 npx playwright test e2e/exported-scenarios.spec.ts --workers=1`                                  |
| Terminale avanzato         | Sessione shell reale autorizzata per progetto, comando/output/chiusura e rifiuto di progetti non aperti  | `e2e/terminal.spec.ts`                                                                                               |
| Sicurezza/a11y             | niente segreti, iframe sandbox, DOM textContent, focus/label/semantic HTML                               | review sorgenti + E2E controlli accessibili                                                                          |

## Vertical slice obbligatorio

Il test `e2e/vertical-slice.spec.ts` crea un progetto vuoto e una pagina, trascina input/pulsante/lista, modifica larghezza/posizione a breakpoint diversi, crea la sorgente IndexedDB e il flow grafico, inserisce un record, verifica lista e log, prova l'errore su input vuoto, attende autosave, chiude/riapre e verifica il record, esporta e reimporta il JSON, quindi scarica e ispeziona lo ZIP.

L'app esportata viene inoltre materializzata in `generated-app`, installata e compilata separatamente; `e2e-generated/generated-app.spec.ts` la avvia su una porta distinta e verifica un inserimento nel suo IndexedDB.

## Stato Git iniziale

La directory iniziale conteneva esclusivamente `PROJECT_SPEC.md` e non era un repository Git. Non sono quindi esistite modifiche Git pregresse da sovrascrivere e non sono state usate operazioni Git distruttive.
