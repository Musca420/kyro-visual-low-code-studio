# Review finale verificata

Data: 18 luglio 2026. Questa review confronta il repository con `PROJECT_SPEC.md`, `aggiunta.md` e `DESKTOP_PRODUCT_ROADMAP.md`. Le prove automatiche usano esclusivamente i controlli disponibili nell'interfaccia per creare componenti e record; non scrivono direttamente nel database del progetto.

## Esito

La Definition of Done MVP e il verticale obbligatorio sono verificati. Frontend Editor consente di progettare senza CSS con drag, nesting, colonne, resize, multiselezione, allineamento, distribuzione, snapping, guide e breakpoint; lo stesso grafo collega eventi, flow, dati, provider, Codex e codice esportato. Landing, sito ricco e dashboard CRUD sono stati creati e collaudati dal percorso visuale.

## Vertical slice e scenari

| Percorso | Prova | Risultato |
|---|---|---|
| Input, pulsante, lista, validazione, IndexedDB, loading/empty/error, salvataggio, riapertura ed export | `e2e/vertical-slice.spec.ts` | Superato |
| Landing rifinita, responsive, due interazioni e ZIP | `e2e/scenarios.spec.ts` | Superato |
| Dashboard con cinque record inseriti dalla preview, CRUD, ricerca, filtro, ordinamento, KPI, validazione e toast | `e2e/scenarios.spec.ts` | Superato |
| Sito multipagina con form, dati, modal, ricerca e navigazione mobile | `e2e/rich-website.spec.ts` | Superato |
| Canvas Canva-like, preview ed export indipendente | `e2e/canva-canvas.spec.ts` | 3 percorsi superati |
| App generata autonoma con flow derivato dal grafo, modulo tipizzato e proprio IndexedDB | `npm run test:generated` | Superato |
| Backend esportato persistente con CRUD reale | `tests/generatedBackend.test.ts` | Superato |
| Android guidato, APK e dispositivo | `e2e/android-build.spec.ts` e screenshot in `artifacts/` | Eseguito nel collaudo dedicato |

Screenshot principali: `artifacts/frontend-editor-canva-columns.png`, `artifacts/frontend-editor-canva-multiselect.png`, `artifacts/frontend-editor-canva-smart-guides.png`, `artifacts/frontend-editor-flow-breakpoint.png`, `artifacts/frontend-editor-flow-ui-action.png`, `artifacts/frontend-editor-auth-flow.png`, `artifacts/frontend-editor-runtime-console.png`, `artifacts/frontend-editor-structured-form.png`, `artifacts/frontend-editor-visual-schema.png`, `artifacts/frontend-editor-data-relations.png`, `artifacts/frontend-editor-file-storage.png`, `artifacts/frontend-editor-react-import.png`, `artifacts/frontend-editor-protected-module.png`, `artifacts/frontend-editor-generated-file.png`, `artifacts/generated-app-flow-module.png`, `artifacts/simple-landing-desktop.png`, `artifacts/simple-landing-mobile.png`, `artifacts/project-dashboard-desktop.png`, `artifacts/project-dashboard-mobile.png`, `artifacts/frontend-editor-codex-timeline.png`, `artifacts/android-device-final.png`.

## Controlli finali riproducibili

- `npm run check`: typecheck e lint senza errori, 11 file Vitest e 57 test superati, build Vite riuscita.
- `npx playwright test e2e/file-flow.spec.ts --workers=1`: 1 test browser superato; upload configurato interamente nell'editor, record persistito e ritrovato alla riapertura.
- `npx playwright test e2e/data-evolution.spec.ts --workers=1`: 1 test browser superato; due entità create, relazione configurata, schema migrato a v2 e riaperto senza perdita.
- `npx playwright test e2e/auth-flow.spec.ts --workers=1`: 1 test browser superato; ruolo lettore bloccato e ruolo editor autorizzato dallo stesso flow.
- `npx playwright test e2e/runtime-observability.spec.ts --workers=1`: 1 test browser superato; errore e oggetto runtime trasferiti dall'iframe isolato alla console visuale.
- `npm run export:sample` e `npm run build` in `generated-app`: export materializzato e compilato indipendentemente, incluso il runtime autenticazione del grafo.
- `npx playwright test`: 32 test browser superati; 3 test dedicati saltati per variabili d'ambiente o artefatti opzionali intenzionali.
- `npx playwright test e2e/design-system.spec.ts --workers=1 --repeat-each=5`: 5/5 superati dopo la correzione del contrasto transitorio.
- `npm run desktop:test`: 2/2, renderer di produzione e apertura cartella nella shell Electron.
- `npm --prefix generated-app run build`: build autonoma riuscita.
- `npm run test:generated`: 1/1, app esportata avviata separatamente e IndexedDB funzionante.
- `npm audit --omit=dev`: 0 vulnerabilità runtime note.

I tre skip della suite generale sono espliciti: build Android completa (`RUN_ANDROID_E2E=1`), pacchetto desktop già prodotto (`RUN_PACKAGED_DESKTOP=1`) e tre export già estratti/avviati (`SCENARIO_EXPORTS=1`). Le prove e gli screenshot dei collaudi dedicati sono conservati in `artifacts/`; non vengono contati come eseguiti nel run generale.

## Review del codice

- **Correttezza e stato:** schema Zod versionato, riferimenti del grafo validati, revision lock per modifiche agentiche, IndexedDB con migrazioni, versioni e backup round-trip.
- **Sicurezza:** renderer Electron isolato e sandboxed, IPC ristretto, import senza esecuzione del codice, limiti su file e backup, segreti esclusi dal progetto, backend con `AUTH_SECRET`, aggiornamenti verificati con Ed25519 e SHA-256.
- **Error handling:** flow con rami success/error, diagnostica preview, stati loading/empty/error e messaggi guidati del Capability Resolver.
- **Accessibilità e responsive:** contrasto minimo 4,5:1 nei percorsi coperti, focus visibile, nomi accessibili, tastiera e assenza di overflow mobile. Non equivale a una certificazione WCAG esterna.
- **Export:** JSON/ZIP aperti, TypeScript leggibile, Web/PWA/Capacitor, backend opzionale, file importati preservati e app avviabile fuori dall'editor.
- **Prestazioni:** manipolazione diretta evita transizioni di layout durante drag/resize; generatori e pannelli pesanti sono caricati separatamente. Il bundle principale resta circa 464 kB non compresso ed è un rischio di ottimizzazione, non un blocco funzionale osservato.
- **Dipendenze:** runtime senza advisory. `npm audit` completo segnala advisory `tar` e `tmp` nella toolchain di sviluppo Electron Forge, senza fix disponibile al momento; non sono dipendenze caricate dal renderer/runtime esportato.

## Difetti trovati e corretti durante il collaudo

- Drop annidato, maniglie fuori viewport, allineamento falsato dai margini, perdita della multiselezione dopo drag, transizioni che inseguivano il puntatore e tooltip sovrapposti alle guide.
- Persistenza inizialmente incompleta per versioni ed export: ora revisioni e ZIP sopravvivono al reload e rientrano nel backup.
- Contributi plugin inizialmente non utilizzabili end-to-end: componenti, nodi, provider e temi sono ora materializzabili e isolati.
- Il test completo ha rilevato contrasto transitorio di 2,85:1 durante l'idratazione del tema: le transizioni di colore/sfondo dei pulsanti sono state eliminate; cinque ripetizioni e la suite completa sono verdi.
- Input file nascosto senza nome accessibile: aggiunta etichetta ARIA e riprovato il percorso tastiera.

## Limiti esterni e rischi residui

- Le cinque persona sono simulazioni browser ripetibili, non sessioni con persone reali. Reclutamento, consenso e osservazione umana richiedono coordinamento esterno.
- Windows è stato impacchettato, installato e avviato. La CI prepara artefatti Windows/macOS/Linux, ma smoke test e firma nativi macOS/Linux richiedono runner e identità di firma esterni.
- Device Guard rifiuta nuovi hash Windows non firmati; una release pubblica e un aggiornamento installato end-to-end richiedono certificato e hosting HTTPS. La policy rifiuta manifest, canale, downgrade o artefatti non validi, ma non viene dichiarata pubblicazione completata.
- L'import generico preserva codice non convertito; la modifica bidirezionale profonda di ogni framework resta un'evoluzione parser-specifica.
- Plugin di codice arbitrario non vengono eseguiti: l'SDK attuale è dichiarativo per mantenere isolamento. Una futura API di codice richiederà sandbox e firma.
