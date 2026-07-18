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
| Canvas Canva-like, preview ed export indipendente | `e2e/canva-canvas.spec.ts`, `e2e/canva-column-resize.spec.ts` | 4 percorsi superati |
| App generata autonoma con flow derivato dal grafo, modulo tipizzato e proprio IndexedDB | `npm run test:generated` | Superato |
| Backend esportato persistente con CRUD reale | `tests/generatedBackend.test.ts` | Superato |
| Android guidato, APK e dispositivo | `e2e/android-build.spec.ts` e screenshot in `artifacts/` | Eseguito nel collaudo dedicato |

Screenshot principali: `artifacts/frontend-editor-canva-columns.png`, `artifacts/frontend-editor-canva-multiselect.png`, `artifacts/frontend-editor-canva-smart-guides.png`, `artifacts/frontend-editor-reusable-component.png`, `artifacts/frontend-editor-flow-breakpoint.png`, `artifacts/frontend-editor-flow-profile.png`, `artifacts/frontend-editor-flow-ui-action.png`, `artifacts/frontend-editor-get-record.png`, `artifacts/frontend-editor-capability-plan.png`, `artifacts/frontend-editor-auth-flow.png`, `artifacts/frontend-editor-runtime-console.png`, `artifacts/frontend-editor-structured-form.png`, `artifacts/frontend-editor-visual-schema.png`, `artifacts/frontend-editor-data-relations.png`, `artifacts/frontend-editor-file-storage.png`, `artifacts/frontend-editor-react-import.png`, `artifacts/frontend-editor-protected-module.png`, `artifacts/frontend-editor-generated-file.png`, `artifacts/generated-app-flow-module.png`, `artifacts/simple-landing-desktop.png`, `artifacts/simple-landing-mobile.png`, `artifacts/project-dashboard-desktop.png`, `artifacts/project-dashboard-mobile.png`, `artifacts/frontend-editor-codex-timeline.png`, `artifacts/android-device-final.png`.

Prova aggiuntiva delle colonne proporzionali: `artifacts/frontend-editor-canva-flexible-columns.png`.
Prova aggiuntiva del nesting visuale: `artifacts/frontend-editor-canva-nesting.png`.

## Controlli finali riproducibili

- `npm run check`: typecheck e lint senza errori, 13 file Vitest e 70 test superati, build Vite riuscita.
- `npx playwright test e2e/canva-column-resize.spec.ts --workers=1`: cinque card trascinate, 1–12 colonne, proporzioni via mouse e tastiera, limiti anti-collasso, undo/redo, desktop/mobile, preview e riapertura.
- `npx playwright test e2e/canva-nesting.spec.ts --workers=1`: livello trascinato dentro/fuori da un container, gerarchia, normalizzazione del posizionamento, undo/redo e DOM preview verificati.
- `npx playwright test e2e/capability-resolver-plan.spec.ts --workers=1`: prerequisiti, alternative, costi e conferma mostrati da un intento pagamento senza configurare servizi.
- `npx playwright test e2e/flow-profile.spec.ts --workers=1`: tempi per nodo visibili, run persistita e replay riaperto dopo il riavvio del progetto.
- `npx playwright test e2e/get-record-flow.spec.ts --workers=1`: caricamento singolo per ID configurato e ritrovato alla riapertura; runtime ed export coperti dai test unitari.
- `npx playwright test e2e/reusable-components.spec.ts --workers=1`: selezione salvata come blocco, nuova istanza nativa modificata e ritrovata alla riapertura.
- `npx playwright test e2e/modal-flow.spec.ts --workers=1`: modal scelta e chiusa dal nodo visuale; visibilità DOM reale verificata nella preview.
- `npx playwright test e2e/navigation-flow.spec.ts --workers=1`: pagina, indietro e URL esterno configurati visualmente; cambio hash reale verificato nella preview.
- `npx playwright test e2e/file-flow.spec.ts --workers=1`: 1 test browser superato; upload configurato interamente nell'editor, record persistito e ritrovato alla riapertura.
- `npx playwright test e2e/data-evolution.spec.ts --workers=1`: 1 test browser superato; due entità create, relazione configurata, schema migrato a v2 e riaperto senza perdita.
- `npx playwright test e2e/auth-flow.spec.ts --workers=1`: 1 test browser superato; ruolo lettore bloccato e ruolo editor autorizzato dallo stesso flow.
- `npx playwright test e2e/runtime-observability.spec.ts --workers=1`: 1 test browser superato; errore e oggetto runtime trasferiti dall'iframe isolato alla console visuale.
- `npm run export:sample` e `npm run build` in `generated-app`: export materializzato e compilato indipendentemente, incluso il runtime autenticazione del grafo.
- `npm run export:specialized`, install/build in `out/experience-landing` e `out/experience-dashboard`, quindi `npm run test:specialized`: 2 export indipendenti compilati e 2 test browser superati sul flow aggiunto al grafo.
- `npx playwright test`: 45 test browser superati; 3 test dedicati saltati per variabili d'ambiente intenzionali.
- `RUN_ANDROID_E2E=1`: 1 test dedicato superato in 75 secondi; struttura Capacitor/Gradle, permessi, versione, splash e nuovo APK verificati. Il successivo tentativo di installazione ADB sul dispositivo collegato è stato annullato due volte dal telefono con `INSTALL_FAILED_USER_RESTRICTED` perché la conferma USB non è stata accettata.
- `RUN_PACKAGED_DESKTOP=1`: 1 smoke test dedicato superato; eseguibile Windows avviato indipendentemente e cartella progetto aperta.
- `npx playwright test e2e/design-system.spec.ts --workers=1 --repeat-each=5`: 5/5 superati dopo la correzione del contrasto transitorio.
- `npm run desktop:test`: 2/2, renderer di produzione e apertura cartella nella shell Electron.
- `npm --prefix generated-app run build`: build autonoma riuscita.
- `npm run test:generated`: 1/1, app esportata avviata separatamente e IndexedDB funzionante.
- `npm audit --omit=dev`: 0 vulnerabilità runtime note.

I tre skip della suite generale sono espliciti: build Android completa (`RUN_ANDROID_E2E=1`), pacchetto desktop già prodotto (`RUN_PACKAGED_DESKTOP=1`) e tre export già estratti/avviati (`SCENARIO_EXPORTS=1`). Android e desktop sono stati riattivati e superati nel collaudo dedicato corrente; gli export Landing/Dashboard aggiornati sono coperti separatamente da `npm run test:specialized`.

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
- Il flow upload passava isolatamente ma poteva perdere il click sul nodo quando sei worker ridimensionavano il canvas: il test usa ora l'identità stabile del nodo e la suite completa è tornata verde.
- Una modal configurata come chiusa manteneva `hidden` nel DOM ma lo stile Grid del componente prevaleva sul foglio utente del browser: preview ed export ora applicano `[hidden]{display:none!important}` e il test visuale ripete la chiusura dal flow.
- Il click forzato sul contenitore trascinabile del nodo navigazione poteva lasciare selezionato il nodo precedente sotto carico parallelo: il collaudo usa ora il contenuto visibile del nodo e verifica subito l'inspector; prova mirata e suite completa sono verdi.
- La cronologia profiling poteva perdersi chiudendo il progetto prima del debounce di autosave: ogni run viene ora salvata immediatamente e in sequenza; cinque ripetizioni parallele e la riapertura sono verdi.
- Aggiungendo un nodo, gli elementi precedenti potevano uscire dall'area visibile del grafo: il Flow Editor esegue ora un auto-fit immediato; il controllo manuale Fit View resta disponibile e cinque ripetizioni modal sono verdi.
- Cronologia e revisione rigeneravano inutilmente l'iframe preview durante il profiling, creando una corsa con l'aggiornamento dei record: la preview dipende ora soltanto da pagina, flow e tema effettivi; vertical slice, form e upload sono tornati verdi in parallelo.
- Il piano guidato del Capability Resolver ereditava testo chiaro sopra il fondo giallo previsto per il tema chiaro: il tema scuro usa ora superficie e testo semantici con contrasto leggibile; screenshot e test browser sono stati rigenerati.
- Le colonne visuali potevano essere solo preset 1–3 e una proporzione estrema schiacciava il contenuto: ora arrivano a dodici, hanno separatori mouse/tastiera per breakpoint e una larghezza minima; cinque card, undo/redo, preview e riapertura sono verificati.
- React Flow poteva adattare soltanto il nodo appena montato, produrre una viewport vuota dopo una cancellazione o confondere click e drag; ora non sposta automaticamente il grafo durante la configurazione, “Mostra tutto” usa i bounds del modello, “Nodi nel flow” seleziona e centra sempre ogni passo, il corpo seleziona senza intercettare le porte e le handle hanno un target più grande. I percorsi flow critici sono stati ripetuti in parallelo e la suite completa è verde.
- Cambiare contenitore richiedeva il selettore “Dentro” e conservava coordinate assolute potenzialmente invisibili: livelli e canvas accettano ora il drag di elementi esistenti, evidenziano il target, rifiutano cicli e normalizzano la posizione su tutti i breakpoint; nesting, uscita e undo/redo sono riprodotti dal browser.

## Limiti esterni e rischi residui

- Le cinque persona sono simulazioni browser ripetibili, non sessioni con persone reali. Reclutamento, consenso e osservazione umana richiedono coordinamento esterno.
- Windows è stato impacchettato, installato e avviato. La CI prepara artefatti Windows/macOS/Linux, ma smoke test e firma nativi macOS/Linux richiedono runner e identità di firma esterni.
- Device Guard rifiuta nuovi hash Windows non firmati; una release pubblica e un aggiornamento installato end-to-end richiedono certificato e hosting HTTPS. La policy rifiuta manifest, canale, downgrade o artefatti non validi, ma non viene dichiarata pubblicazione completata.
- Il telefono Android collegato è visibile ad ADB, ma l'installazione della build corrente richiede confermare sul dispositivo “Consenti installazione via USB”; due tentativi sono stati annullati dal sistema. Non viene dichiarata installata questa nuova build, mentre generazione e compilazione APK sono verificate.
- L'import generico preserva codice non convertito; la modifica bidirezionale profonda di ogni framework resta un'evoluzione parser-specifica.
- Plugin di codice arbitrario non vengono eseguiti: l'SDK attuale è dichiarativo per mantenere isolamento. Una futura API di codice richiederà sandbox e firma.
