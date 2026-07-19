# Kyro — Visual Low-Code Studio

> OpenAI Build Week 2026 · Developer Tools track. See [hackathon compliance](./HACKATHON_COMPLIANCE.md), the binding [NexusField validation plan](./final_plan.md), and the [visual release evidence](./DAILYFLOW_VISUAL_RELEASE_REPORT.md).

**Run reusable flow** passes the current value into another visual flow and returns its final value to the calling graph. The guided target list excludes the current flow; preview and generated code share cycle detection and a maximum nesting depth. This keeps recurring behavior as readable Node-RED-style building blocks instead of duplicated chains.

A local-first visual low-code editor for responsive interfaces, deterministic Node-RED-style flows, IndexedDB data, native capabilities, and independent TypeScript/Vite or Android exports.

Il Flow Editor permette di aggiungere liberamente nodi da una palette ricercabile, organizzata in **Interazioni**, **Dati e API** e **Avanzato** con apertura progressiva. L'evento iniziale configura visualmente click, cambio campo, invio form, apertura pagina o timer; il collegamento al componente viene sincronizzato automaticamente e lo stesso trigger governa preview generica ed export. I nodi si collegano trascinando i pallini oppure con i menu accessibili **Uscita da collegare** e **Passo successivo**, che applicano la stessa verifica dei tipi. **Cambia elemento** mostra, nasconde, abilita, disabilita o aggiorna testo, valore, colore, sfondo e trasparenza di un elemento durante l'uso. Configurazione e collegamenti usano nomi comprensibili: success/error, uscite nominate dello switch o percorsi “ogni elemento/completato” del loop. Il ciclo impone sia un limite visuale di elementi sia un tetto globale di esecuzione. Stato applicativo, attese e debounce, composizione di testo e liste, API HTTP/HTTPS, CRUD, filtro, ordinamento e KPI usano lo stesso runtime. Quando i nodi comuni non bastano, **Funzione avanzata** crea una trasformazione tipizzata e protetta, la prova con casi input/risultato atteso, la esegue nel flow e la esporta come modulo TypeScript leggibile senza `eval`.

Il confronto funzionale aggiornato con i visual builder e la roadmap verificabile sono in [BENCHMARK_ROADMAP.md](./BENCHMARK_ROADMAP.md). Il modello include anche l'intento semantico degli elementi; il pannello **Programma collegato** attraversa eventi, flow, dati e file generati e segnala le capability mancanti allo stesso Live Bridge usato da Codex. I file derivati dal componente, dal nodo o dalla sorgente selezionata sono pulsanti reali: si aprono in un inspector di sola lettura che mostra il contenuto effettivamente esportato e mantiene esplicita la provenienza dal grafo.

Per capability esterne come pagamenti, storage, autenticazione e notifiche Android, **Confronta le soluzioni** espone prima prerequisiti, alternative locali o gestite, implicazioni di costo e credenziali e la necessità di conferma. Nessun account, segreto o servizio a pagamento viene configurato implicitamente. `e2e/capability-resolver-plan.spec.ts` verifica questo percorso partendo dall'intento scritto su un pulsante.

Per il debug, ogni nodo può attivare **Ferma qui**, sempre oppure solo quando il valore è uguale a/contiene un testo. La preview sospende davvero l’operazione prima del nodo, mostra il valore corrente e riparte soltanto con **Continua esecuzione**. La console riproduce i passi dall’inizio manualmente o in automatico e seleziona sul canvas il nodo corrispondente a ogni valore.

Il pannello **Nodi nel flow** funziona come i Livelli del design: mantiene ogni passo selezionabile per nome e centra il canvas sul nodo scelto, anche dopo aggiunte o cancellazioni. **Mostra tutto** calcola la viewport dalle posizioni del grafo sorgente senza dipendere dalla cache visuale della libreria.

Ogni passo mostra anche la durata in millisecondi. Le ultime 20 esecuzioni, con flow, esito, messaggio e tempo per nodo ma senza payload potenzialmente sensibili o pesanti, restano nel progetto versionabile e possono essere riaperte nella console dopo un riavvio. La run viene salvata immediatamente prima di concludere l'azione, quindi chiudere subito la preview non la perde. Quando si aggiunge un nodo il grafo si ricentra automaticamente. `e2e/flow-profile.spec.ts` verifica misura, salvataggio, riapertura e replay persistente.

Nel generatore web generico, eventi, nodi, rami success/error e moduli protetti vengono serializzati dal medesimo grafo ed eseguiti da un runtime TypeScript deterministico. `npm run export:sample`, build e `npm run test:generated` dimostrano separatamente il percorso evento → validazione → modulo → IndexedDB → refresh, senza un handler simulato nell’export.

I plugin seguono l'[SDK dichiarativo](./PLUGIN_SDK.md): possono contribuire preset di componenti, nodi, provider REST e temi con permessi espliciti, senza eseguire codice di terzi nell'editor. Una volta applicato, ogni contributo diventa parte del formato aperto e continua a funzionare anche se il plugin viene disabilitato o nell'export standalone.

Le cinque prove browser per persona visuale e i limiti della simulazione sono registrati in [PERSONA_TEST_REPORT.md](./PERSONA_TEST_REPORT.md).

La policy e il formato del canale desktop firmato sono descritti in [UPDATE_SECURITY.md](./UPDATE_SECURITY.md). Firma del manifest, anti-downgrade, canale/piattaforma e SHA-256 sono verificati localmente; la pubblicazione resta disabilitata senza chiavi e certificati di release esterni.

La review conclusiva con matrice delle prove, comandi, difetti corretti e limiti realmente osservati è in [FINAL_REVIEW.md](./FINAL_REVIEW.md).

Ogni autosalvataggio conserva una revisione ripristinabile (massimo 40 per progetto). Gli ultimi 10 export JSON/ZIP restano nello storico locale e possono essere riscaricati dopo un riavvio; versioni ed export sono inclusi nel backup completo. `e2e/persistence-history.spec.ts` verifica modifica, restore, export, reload, nuovo download e contenuto del backup.

`.github/workflows/desktop-build.yml` prepara artefatti non firmati su Windows, macOS e Linux; la promozione a release resta separata e richiede firma del sistema operativo. `e2e/accessibility-primary.spec.ts` verifica nomi dei controlli, focus visibile, tastiera e assenza di overflow; `e2e/design-system.spec.ts` copre contrasto, temi e layout mobile.

Il refactoring UI e la trasformazione in prodotto desktop installabile fanno parte della Definition of Done in [DESKTOP_PRODUCT_ROADMAP.md](./DESKTOP_PRODUCT_ROADMAP.md). La shell scelta è Electron perché riusa i servizi Node locali già necessari a Live Bridge, Codex, terminale, import ed export; formato ed applicazioni esportate restano aperti e indipendenti.

Per chi arriva da Canva, il pannello proprietà parte in modalità **Essenziale**: palette, colori, gradienti, immagini di sfondo, font, allineamento, angoli, spaziatura, ombre e animazioni aggiornano subito canvas e preview. Senza selezione, lo stesso pannello modifica lo sfondo globale di pagina. **Avanzata** espone tutti i valori precisi senza cambiare modello.

I contenitori mostrano inoltre **Disponi il contenuto** nella modalità Essenziale: colonna, riga, due o tre colonne, gap con cursore, allineamento, distribuzione e ritorno a capo si impostano senza CSS. Le scelte valgono per il breakpoint attivo, sono annullabili e restano identiche in preview, export e dopo la riapertura. `e2e/canva-essential-layout.spec.ts` attraversa l'intero percorso desktop/mobile con tre card create dalla palette.

I pannelli Elementi e Proprietà hanno separatori ridimensionabili sempre raggiungibili anche durante lo scorrimento. Si trascinano con il mouse, si regolano con le frecce, accettano Home/Fine, tornano alla misura iniziale con doppio clic e ricordano la scelta alla riapertura; su mobile scompaiono per lasciare spazio al canvas. Il percorso è verificato da `e2e/canva-panel-resize.spec.ts`.

Sul canvas un contenitore selezionato offre preset e aggiunta/rimozione fino a dodici colonne per ogni breakpoint. I separatori si trascinano direttamente per cambiare le proporzioni, accettano le frecce da tastiera e impediscono di collassare il contenuto. Gli elementi possono essere trascinati nelle colonne; maniglia di spostamento, resize orizzontale/verticale, griglia a 8 px e guide intelligenti sui bordi e sui centri rendono le modifiche dirette annullabili come una singola operazione. Con un riquadro oppure Ctrl/Cmd si selezionano più elementi per allinearli, distribuirli o spostarli come gruppo; il posizionamento libero resta identico in editor, preview ed export. I test `e2e/canva-canvas.spec.ts` e `e2e/canva-column-resize.spec.ts` verificano anche undo/redo, salvataggio, riapertura e preview desktop/mobile.

I livelli sono trascinabili: un elemento esistente può essere portato dentro un container, stack o griglia dal pannello Livelli, riordinato prima o dopo un fratello con un indicatore visivo e riportato sulla pagina lasciandolo sul canvas. Il target viene evidenziato, cicli e auto-annidamento sono rifiutati, il posizionamento viene normalizzato per non far sparire il contenuto e l'intera modifica usa la stessa cronologia undo/redo. `e2e/canva-nesting.spec.ts` e `e2e/canva-layer-reorder.spec.ts` provano nesting, uscita, ordine, ripristino e DOM della preview senza modificare JSON o codice.

La sezione **I tuoi blocchi** salva una selezione, inclusi gli elementi annidati, come componente riutilizzabile del progetto. Un blocco può essere reinserito con clic o drag-and-drop: ogni istanza riceve ID nuovi e si materializza come un gruppo di componenti nativi, quindi testo, stile, struttura e responsive restano modificabili dal normale inspector e continuano nell'export senza runtime proprietari. Flow e binding non vengono copiati implicitamente, per evitare collegamenti invisibili all'istanza originale. `e2e/reusable-components.spec.ts` verifica creazione, riuso, modifica della copia, salvataggio e riapertura.

I requisiti di prodotto e la Definition of Done complessiva sono definiti da `PROJECT_SPEC.md`, `versione 2.md` e `aggiunta.md`. In particolare, i flussi principali devono restare completabili da utenti non tecnici senza codice o terminale.

La dashboard può anche importare una cartella Web, PWA o Capacitor esistente. Se trova `project.frontend-editor.json` ripristina integralmente canvas, flow, dati e configurazione; altrimenti converte HTML semantico e markup statico riconoscibile di React, Vue o Svelte in componenti visuali, conservando CSS, componenti dinamici e JavaScript non ancora convertiti. Dipendenze e cartelle di build vengono ignorate, il codice importato non viene mai eseguito durante l'analisi e l'export mantiene i file originali sotto `original-project/`.

La sezione **Progetti recenti** offre ricerca, duplicazione, eliminazione e backup/ripristino. Il backup aperto e validato include progetti, record IndexedDB, plugin, tema, associazioni delle cartelle desktop e conversazioni Codex; il ripristino è additivo, quindi non cancella progetti già presenti.

## Start from the repository

Richiede Node.js 20 o successivo.

```bash
npm install
npm link
kyro
```

Run `kyro` inside an existing project folder to import it directly. Run it from any other folder to open Home and choose or create a project visually. `kyro "path/to/project"` always opens the explicit folder. Kyro starts a local server and opens the trusted system browser, avoiding unsigned desktop binaries. Project data stays in browser IndexedDB and is not sent to an external service.

Use `kyro --home` when you explicitly want Home even if the current folder contains a project.

The CLI reads only the selected workspace, ignores dependencies, builds and symbolic links, and enforces explicit source-file and size limits. Press `Ctrl+C` in the launching terminal to stop Kyro. Electron packaging remains available for signed release builds only; it is not the repository workflow.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run desktop:test
npm run desktop:test:packaged

# Materialize, install, and verify the independent output
npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated

# After extracting and starting the test ZIP files on ports 4181-4183
SCENARIO_EXPORTS=1 npx playwright test e2e/exported-scenarios.spec.ts --workers=1
```

## Percorso MVP

Da “Progetto vuoto”: crea una pagina, trascina input, button e list, modifica proprietà e breakpoint, crea una sorgente nella scheda Dati, quindi crea il flow nella scheda Flow. In Preview, il click legge e valida l'input, inserisce `{id, text, date}` in IndexedDB e aggiorna la lista. La console mostra ogni nodo eseguito e il percorso di errore. Autosave permette di chiudere e riaprire senza perdita.

“Lista attività” crea invece una pagina con i componenti iniziali; dati e flow restano esplicitamente configurabili.

## Architettura

- `src/model.ts`: source of truth JSON v1, Zod, migrazione v0→v1, riferimenti e serializzazione deterministica.
- `src/db.ts`: adapter IndexedDB locale per progetti, record e manifest plugin.
- `src/flow.ts`: runtime sequenziale con success/error, timeout, cancellazione e blocco loop.
- `src/PreviewFrame.tsx`: preview in iframe sandbox senza accesso al contesto editor; usa messaggi e DOM sicuro (`textContent`).
- `src/generator.ts`: ZIP TypeScript/Vite con routing hash, responsive CSS, IndexedDB e configurazione Capacitor.
- `src/PluginManager.tsx`: catalogo locale; valida manifest, impedisce collisioni ed evita esecuzione di codice plugin.
- `vite.config.ts`: Live Bridge locale vincolato al workspace; sincronizza stato/revision, espone operazioni visuali tipizzate e gestisce sessioni terminale locali autorizzate per progetto.
- `src/TerminalPanel.tsx`: shell persistente avanzata con output progressivo, comando esplicito, terminazione e isolamento logico per progetto; le variabili d’ambiente che sembrano segreti non vengono ereditate.
- `src/editorOperations.ts`: transazioni validate per proprietà, stili, responsive, componenti, flow, binding e sorgenti dati.
- `src/CodexPanel.tsx`: contesto certo del componente, Codex CLI ufficiale, analisi read-only, aggiornamenti progressivi, cronologia per progetto e approvazione prima dell’applicazione.
- `src/capture.ts`: screenshot PNG del canvas; la preview invia un DOM privo di script e viene rasterizzata fuori dall’iframe senza indebolire la sandbox.

Il modello visuale è la source of truth; il codice è un derivato. Non esiste sincronizzazione bidirezionale con codice arbitrario.

## Esperienza guidata e Codex live

Ogni controllo mostra una spiegazione al passaggio del mouse o al focus. La barra “Prossimo passo” accompagna dalla pagina alla preview. Il clic destro su un componente offre azioni Codex per comportamento, dati, correzione, miglioramento e spiegazione.

L'ispettore visuale copre dimensioni min/max, Flexbox, Grid, spaziatura per lato, tipografia, sfondi e gradienti, bordi per angolo, ombre, filtri, trasformazioni, animazioni, posizione, overflow, responsive e stati hover/focus/active/disabled. Gli override sono strutturati, immediati, annullabili e condivisi da canvas, preview ed export.

L'onboarding offre template per landing page, portfolio, sito aziendale, blog, e-commerce, dashboard, autenticazione, gestionale e applicazione mobile. La ricerca accetta anche termini italiani pratici (per esempio “grafico” trova `chart`); `Ctrl+K` apre i comandi rapidi per navigare e aggiungere componenti.

Il pannello inferiore mostra target, ID stabile, pagina, revisione, flow, dati e workspace. `Analizza richiesta` esegue `codex exec` in sandbox read-only; solo “Approva e applica” abilita workspace-write. Il login resta quello ufficiale della CLI (`codex login`): l’app non legge o salva token.

Ogni richiesta Codex viene registrata nella scheda **Cronologia** con componente, revisione, stato, screenshot prima/dopo, file e test. Le ultime 100 operazioni per progetto restano in IndexedDB, entrano nel backup e possono mostrare il ripristino atomico della modifica.

La scheda **Terminale** è separata dal percorso guidato e destinata agli utenti avanzati. Avvia una sessione persistente soltanto per un progetto aperto, nella cartella locale del workspace; ogni comando viene inviato esclusivamente premendo **Esegui**, l’output è limitato e la sessione può essere terminata dall’interfaccia. Il bridge rifiuta progetti non autorizzati e non viene incluso nell’export.

La skill repo-specific è in `.agents/skills/frontend-editor-live`. Verifica bridge e contesto con:

```powershell
.\.agents\skills\frontend-editor-live\scripts\check_live_bridge.ps1
.\.agents\skills\frontend-editor-live\scripts\invoke_live_tool.ps1 get_editor_status
```

## Modello e sicurezza

Il formato include metadati, pagine, componenti tipizzati, stili desktop/tablet/mobile, accessibilità, eventi/binding, flow, stato, sorgenti/schema, tema, animazioni, asset, plugin/dipendenze ed export. Gli ID sono stabili e i riferimenti vengono verificati all'import.

Segreti, token e password non appartengono al modello. Il provider MVP non richiede segreti. Import e manifest sono validati; la preview non usa `eval`, non inserisce HTML dinamico non fidato e ha `sandbox="allow-scripts"`. L'eliminazione progetto richiede conferma. I plugin dichiarano permessi ma, nell'MVP, non eseguono codice.

La scheda Dati propone in termini pratici tre destinazioni: IndexedDB sul dispositivo, una API REST esistente o un backend Node generato. Un costruttore visuale permette di aggiungere e rimuovere campi, scegliere testo, numero, sì/no o data e valida nomi e duplicati prima di creare la sorgente. Input, textarea, select e controlli di scelta espongono un nome campo; i pulsanti possono inviare o azzerare il form. Il nodo **Valida** applica a un campo specifico regole obbligatorio, email, lunghezza minima e limiti numerici con un messaggio comprensibile e un ramo d'errore. I submit visuali attraversano il flow come record strutturati: IndexedDB, REST e backend generato conservano tutti i campi senza ridurli a testo. Per le API, l'export legge il token da `VITE_API_TOKEN`; non viene serializzato nel progetto. Il backend generato espone CRUD su `/records`, persiste in `server/data.json` e può aggiungere autenticazione email/password con sessioni firmate, ruoli e aggiornamenti SSE. La prima registrazione crea l'amministratore; le password sono derivate con `scrypt` e i segreti restano nelle variabili d'ambiente. `tests/generatedBackend.test.ts` compila l'app esportata, avvia il server e verifica registrazione, login, autorizzazione, CRUD, persistenza e SSE.

La scheda Pubblica configura con controlli guidati accesso, ruoli, modalità offline, aggiornamenti automatici e nomi delle variabili d'ambiente. Se l'utente abilita l'accesso gestito senza un backend, l'editor segnala il requisito mancante e porta alla procedura per generarlo. Il valore dei segreti non viene mai salvato nel progetto; l'export crea soltanto un `.env.example` vuoto.

Nella stessa scheda, Asset consente di caricare immagini, audio e video fino a 2 MB. I file vengono salvati nel progetto e possono essere assegnati ai relativi componenti dal campo **File del progetto** nell'ispettore; `e2e/assets.spec.ts` verifica upload, preview, salvataggio e riapertura.

Il componente **Upload** può inoltre avviare un flow al cambio del file. Il nodo visuale **Prepara file** controlla dimensione e formati ammessi, legge il contenuto senza eseguire nulla e produce un record con nome, MIME type, dimensione e data URL. Il record può essere collegato a **Crea record** e persiste nella sorgente locale; preview ed export usano lo stesso percorso. `e2e/file-flow.spec.ts` copre costruzione senza codice, caricamento reale, persistenza e riapertura.

Una sorgente già creata non è bloccata: **Evoluzione sicura** permette di aggiungere, rimuovere o cambiare campi e salva una nuova versione con schema precedente e successivo, senza cancellare i record IndexedDB esistenti. Dallo stesso pannello si collegano entità diverse scegliendo campo locale, sorgente, campo destinazione e cardinalità. Le relazioni mancanti o incoerenti vengono rifiutate durante la validazione del progetto; `e2e/data-evolution.spec.ts` verifica migrazione, relazione e persistenza dopo la riapertura.

La categoria **Accesso** del Flow Editor contiene **Controlla ruolo** ed **Esci dall’account**. Il controllo espone i percorsi consentito/negato, accetta ruoli in linguaggio semplice e permette di simulare admin, editor o lettore in preview. Nell’export il ruolo viene letto dalla sessione firmata, mentre logout elimina la sessione e torna al gate di accesso. `e2e/auth-flow.spec.ts` verifica un’azione negata a un lettore e riuscita a un editor.

Il nodo **Carica dati** può restituire l’intero elenco oppure un solo record per ID. L’ID può essere scritto direttamente o arrivare dal valore/campo del passo precedente; ID vuoti e record mancanti seguono il ramo errore con un messaggio comprensibile. Preview ed export applicano la stessa risoluzione. `e2e/get-record-flow.spec.ts` verifica configurazione e persistenza interamente visuali.

La preview inoltra automaticamente log, avvisi, errori JavaScript e promise non gestite alla console visuale dell’editor. I messaggi sono limitati agli ultimi 200 elementi e rendono visibili anche oggetti e ID di componente senza aprire DevTools. `e2e/runtime-observability.spec.ts` verifica il ponte dal runtime isolato al pannello.

Anche gli export rifiniti **Landing** e **Dashboard** caricano ora il runtime del grafo unificato. Il template continua a fornire navigazione, modal, ricerca e CRUD pronti, ma eventi e nodi aggiunti dall’utente vengono risolti tramite l’identità stabile `data-component`, senza sostituire gli ID interni usati dai widget specializzati. `npm run export:specialized` materializza entrambi gli export e `npm run test:specialized` li avvia su porte separate e attraversa un flow personalizzato reale.

Il nodo **Vai alla pagina** offre tre scelte visuali: una pagina del progetto, torna indietro o un sito esterno. Preview ed export condividono il comportamento; gli indirizzi esterni accettano soltanto HTTP/HTTPS. `e2e/navigation-flow.spec.ts` verifica la configurazione senza codice e la navigazione effettiva nella preview.

Il nodo **Gestisci modal** apre o chiude un dialogo scelto dall'elenco degli elementi, senza CSS o JavaScript. L'attributo `hidden` ha precedenza esplicita sugli stili del componente sia in preview sia nell'export, quindi anche una modal con layout Grid viene realmente rimossa dalla navigazione e dal rendering quando è chiusa. `e2e/modal-flow.spec.ts` costruisce e verifica il percorso interamente dall'interfaccia visuale.

## Android / Capacitor

Selezionando Android nell'onboarding, la scheda **Pubblica** permette di configurare nome, package ID, orientamento, tema, versione, permessi, tastiera e back button. **Verifica strumenti** rileva Java, Android SDK, ADB e Android Studio; **Prepara progetto Android** crea un workspace separato, installa Capacitor 8, applica la configurazione nativa (inclusi icona, splash, safe area e status bar), sincronizza la cartella Android e compila l'APK quando la toolchain è disponibile.

Ogni export Android include `capacitor.config.ts`. Il percorso manuale equivalente è:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
```

In questo ambiente il rilevamento automatico trova Android SDK e il JBR di Android Studio anche se non sono nel `PATH`. Il test UI-only `RUN_ANDROID_E2E=1 npx playwright test e2e/android-build.spec.ts --workers=1` ha generato e compilato realmente `app-debug.apk`; l'APK è stato inoltre installato e avviato su un dispositivo fisico, verificando safe area, tastiera, orientamento verticale, tasto Indietro e persistenza IndexedDB dopo il riavvio.

## Limiti dichiarati

- Il vertical slice, il provider IndexedDB, l'export web e il plugin di esempio sono completi e reali.
- Il catalogo espone tutti i componenti MVP con modello/stili/eventi/accessibilità; i componenti fuori dal vertical slice hanno rendering semantico di base, non widget avanzati completi.
- Il runtime MVP esegue i nodi del vertical slice. L'autenticazione generata, i ruoli, REST e SSE sono reali nell'export con backend Node; OIDC resta una configurazione per un provider esterno e richiede credenziali. Database remoti gestiti e marketplace remoto non sono simulati né dichiarati pronti.
- Snap/guide, componenti riutilizzabili avanzati e isolamento di codice plugin non attendibile sono fuori dal vertical slice e non vengono dichiarati pronti. Animazioni, transizioni, trasformazioni e stati interattivi sono invece configurabili dall’ispettore.
- Il runtime dell'export generico deriva dal grafo tutti i flow e i relativi trigger. I generatori specializzati landing/dashboard conservano ancora comportamento dedicato mentre vengono portati allo stesso livello di generalità.
- Un progetto importato con `project.frontend-editor.json` è modificabile integralmente. Per cartelle generiche l’HTML statico viene convertito; codice arbitrario di framework viene preservato sotto `original-project/` e richiede conversione progressiva prima che ogni costrutto sia modificabile sul canvas.
- La v2 Codex live ha stato, contesto, screenshot canvas/preview, revision lock, operazioni strutturate, undo, gerarchie annidate con `wrap_component`, job progressivi, cronologia locale, ripristino protetto e terminale persistente. La shell esegue comandi reali e conserva `cd` e stato della sessione, ma non emula ancora programmi TUI che richiedono un PTY completo (per esempio editor terminali a schermo intero).

Stato verificato e matrice dei requisiti: [MVP_STATUS.md](./MVP_STATUS.md).

Percorsi, conteggio delle azioni, difetti corretti, screenshot e limiti osservati dei test A/B/C: [USABILITY_REPORT.md](./USABILITY_REPORT.md).
