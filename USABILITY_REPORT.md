# Collaudo di usabilità e prove riproducibili

Data: 18 luglio 2026. Tutti i progetti descritti qui sono stati creati usando esclusivamente controlli disponibili nell’interfaccia. Playwright ha automatizzato clic, compilazione, selezione, navigazione da tastiera e drag-and-drop equivalenti alle azioni di un utente; non sono stati inseriti componenti o record modificando direttamente lo stato o il database.

## Test A — sito web ricco

Progetto: **Professional Website Test A**.

- 38 azioni principali: creazione da template, selezione visuale, modifica di sfondo e animazione, sorgente IndexedDB, tre flow, preview, navigazione, modal, filtro prezzi, validazione e invio form, cambio viewport, salvataggio, chiusura/riapertura ed export.
- Risultato: tre pagine visuali (Landing, Prezzi, Contatti), navbar mobile, hero con visuale, sezioni animate, tre feature, modal, ricerca piani con stato vuoto, form validato, record persistente, footer e layout desktop/mobile.
- Dati: la richiesta `Giulia Rossi <giulia@example.it>` è stata creata dalla preview, ritrovata dopo la riapertura e non inserita direttamente in IndexedDB.
- Flow: navigazione alle feature, notifica e invio contatto con lettura input, validazione, insert, refresh e percorso errore.
- Codex: nessuna richiesta necessaria per completare il percorso; tutti i passaggi principali erano disponibili graficamente. La modifica equivalente tramite Codex è coperta separatamente da `e2e/codex-context.spec.ts`.
- Interventi manuali sul progetto creato: nessuno. Le correzioni hanno riguardato il codice del prodotto dopo la riproduzione dei difetti.
- Prove: `e2e/rich-website.spec.ts`, `artifacts/professional-website-contact-desktop.png`, `artifacts/professional-website-mobile.png`, `artifacts/professional-website-test-a.zip` e `artifacts/professional-website-export.png`.

Punti confusi e difetti osservati:

1. Gli elementi con attributo `hidden` potevano restare visibili quando una regola visuale impostava `display`. Correzione: regola globale prioritaria e nuovo test su filtro e cambio pagina.
2. Il primo clic sul form non rendeva sempre visibile il messaggio di validazione nativo. Correzione: gestione esplicita e accessibile di click/invalid, mantenendo `checkValidity` e `reportValidity`.
3. L’export applicava gli stili ai selettori `id`, mentre le esperienze Landing/Dashboard usavano `data-component`. Correzione: il generatore produce entrambi i selettori; il test dell’export confronta ora il colore scelto nell’editor.
4. Dopo un cambio viewport il documento iframe viene ricreato. Il test attende ora che il nuovo documento sia visibile prima del clic sul menu, evitando di attribuire al prodotto un clic avvenuto durante il caricamento.

## Test B — applicazione gestionale

Progetto: **Project Management Dashboard**.

- 74 azioni principali: template, sorgente locale, sette flow, validazione, cinque inserimenti dalla preview, KPI, ricerca, filtro, ordinamento, modifica, conferma eliminazione, reinserimento, stato vuoto, navigazione mobile, chiusura/riapertura ed export.
- Risultato: sidebar/topbar, quattro KPI, tabella responsive, CRUD reale IndexedDB, ricerca, filtro, ordinamento, loading, empty/error state, form completo, validazione, modal dettaglio/modifica, conferma eliminazione e toast.
- Record: cinque record creati tramite il form dell’app in preview; dopo modifica/eliminazione/reinserimento la lista resta di cinque elementi e persiste alla riapertura.
- Accesso configurabile: UI di autenticazione, ruoli, offline e SSE verificata in `e2e/application-config.spec.ts`; backend con registrazione, login, autorizzazione, CRUD, persistenza e SSE verificato in `tests/generatedBackend.test.ts`.
- Codex e interventi manuali: nessuna richiesta Codex e nessuna modifica diretta ai record necessarie nel percorso gestionale.
- Prove: `e2e/scenarios.spec.ts`, `e2e/application-config.spec.ts`, `tests/generatedBackend.test.ts`, `artifacts/project-dashboard-desktop.png`, `artifacts/project-dashboard-mobile.png`, `artifacts/project-management-dashboard.zip` e `artifacts/project-dashboard-export.png`.

## Test C — Android

- 24 azioni principali nell’interfaccia: scelta Android, identità applicazione, versione, orientamento, tastiera, permessi, icona/splash, safe area, back button, sorgente/flow, preparazione e monitoraggio build.
- Risultato: struttura Capacitor 8 generata, dipendenze installate, Web build, sync Android e APK debug compilato. APK installato sul dispositivo fisico `24117RN76E`.
- Verifiche fisiche: avvio a freddo, tastiera, safe area/status bar, orientamento portrait, creazione record, persistenza dopo force-stop/riapertura e tasto Indietro fino al launcher.
- Errori osservati: installazione streaming rifiutata dal dispositivo, risolta ripetendo l’installazione ADB in modalità `--no-streaming`; mapping iniziale delle icone status bar invertito, corretto e ricompilato.
- Codex/interventi manuali: nessuna modifica manuale ai file Android generati; ADB è stato usato soltanto per installazione, avvio e osservazione del risultato sul dispositivo.
- Prove: `e2e/android-build.spec.ts`, `artifacts/android-device-final.png`, `artifacts/android-keyboard.png`, `artifacts/android-reopened.png` e output della build registrato dal job Android.

## Import di un progetto esistente

La cartella dell’ultima applicazione Android generata è stata selezionata dal controllo cartella della dashboard. Frontend Editor ha rilevato Capacitor, importato 47 file, ripristinato il modello visuale, permesso una modifica grafica, salvato e riaperto il progetto, quindi esportato lo ZIP conservando `original-project/capacitor.config.ts`. Prove: `e2e/folder-import.spec.ts`, `tests/folderImport.test.ts` e `artifacts/imported-android-app.png`.

## Avvio separato degli export

Gli ZIP Simple Landing Page, Project Management Dashboard e Professional Website Test A sono stati estratti in directory distinte, installati con `npm install`, compilati con `npm run build` e avviati sulle porte 4181, 4182 e 4183. `e2e/exported-scenarios.spec.ts`, eseguito con `SCENARIO_EXPORTS=1`, verifica interazioni landing, CRUD/KPI/ricerca dashboard, stile visuale, filtro e persistenza del sito professionale.

## Limiti realmente osservati

- L’importazione generica converte semanticamente HTML statico; applicazioni React/Vue/Svelte/Angular arbitrarie vengono preservate integralmente ma richiedono una conversione progressiva per rendere ogni costrutto proprietario modificabile nel canvas. Il codice importato non viene eseguito durante l’analisi.
- Il terminale avanzato esegue comandi reali in una sessione persistente e isolata logicamente per progetto, ma non supporta ancora programmi TUI a schermo intero che richiedono un PTY completo. I flussi principali non tecnici non lo richiedono; Codex usa il bridge locale con modalità read-only/workspace-write e approvazione esplicita.
- Pubblicazione su store, hosting e servizi cloud non è stata eseguita perché comporta account, credenziali o costi esterni; build e avvio locali sono verificati.
