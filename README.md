# Frontend Editor

Editor visuale low-code locale per creare UI responsive, collegare flow deterministici, usare IndexedDB e generare un'app TypeScript/Vite indipendente.

Il confronto funzionale aggiornato con i visual builder e la roadmap verificabile sono in [BENCHMARK_ROADMAP.md](./BENCHMARK_ROADMAP.md). Il modello include anche l'intento semantico degli elementi; il pannello **Programma collegato** attraversa eventi, flow, dati e file generati e segnala le capability mancanti allo stesso Live Bridge usato da Codex.

Il refactoring UI e la trasformazione in prodotto desktop installabile fanno parte della Definition of Done in [DESKTOP_PRODUCT_ROADMAP.md](./DESKTOP_PRODUCT_ROADMAP.md). La shell scelta è Electron perché riusa i servizi Node locali già necessari a Live Bridge, Codex, terminale, import ed export; formato ed applicazioni esportate restano aperti e indipendenti.

Per chi arriva da Canva, il pannello proprietà parte in modalità **Essenziale**: palette, colori, gradienti, immagini di sfondo, font, allineamento, angoli, spaziatura, ombre e animazioni aggiornano subito canvas e preview. Senza selezione, lo stesso pannello modifica lo sfondo globale di pagina. **Avanzata** espone tutti i valori precisi senza cambiare modello.

Sul canvas un contenitore selezionato offre layout guidati a una, due o tre colonne per ogni breakpoint. Gli elementi possono essere trascinati nelle colonne; maniglia di spostamento, resize orizzontale/verticale, griglia a 8 px e guide rendono le modifiche dirette annullabili come una singola operazione. Il test `e2e/canva-canvas.spec.ts` verifica anche salvataggio, riapertura, preview desktop/mobile ed export avviabile separatamente.

I requisiti di prodotto e la Definition of Done complessiva sono definiti da `PROJECT_SPEC.md`, `versione 2.md` e `aggiunta.md`. In particolare, i flussi principali devono restare completabili da utenti non tecnici senza codice o terminale.

La dashboard può anche importare una cartella Web, PWA o Capacitor esistente. Se trova `project.frontend-editor.json` ripristina integralmente canvas, flow, dati e configurazione; altrimenti converte l'HTML semantico in componenti visuali e conserva CSS/JavaScript non ancora convertiti. Dipendenze e cartelle di build vengono ignorate, il codice importato non viene eseguito durante l'analisi e l'export mantiene i file originali sotto `original-project/`.

La sezione **Progetti recenti** offre ricerca, duplicazione, eliminazione e backup/ripristino. Il backup aperto e validato include progetti, record IndexedDB, plugin, tema, associazioni delle cartelle desktop e conversazioni Codex; il ripristino è additivo, quindi non cancella progetti già presenti.

## Avvio

Richiede Node.js 20 o successivo.

```bash
npm install
npm run dev
```

Aprire `http://127.0.0.1:5173`. I progetti e i record sono salvati nell'IndexedDB del browser; non vengono inviati a servizi esterni.

### Desktop e CLI

```bash
# shell desktop in sviluppo, aprendo una cartella esistente
npm run desktop:dev -- --project "C:\percorso\progetto"

# registra il comando globale dal checkout locale
npm link
frontend-editor "C:\percorso\progetto"

# pacchetto nativo e installer della piattaforma corrente
npm run desktop:package
npm run desktop:make
```

La shell usa isolamento del contesto, sandbox e renderer senza Node. La CLI autorizza una sola cartella, ignora dipendenze/build/link simbolici e importa soltanto file sorgente testuali entro limiti espliciti. Su Windows l'installer Squirrel crea collegamenti Desktop e Start Menu; le configurazioni Forge includono maker per ZIP macOS, DEB e RPM Linux da produrre sui rispettivi sistemi.

## Verifica

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run desktop:test
npm run desktop:test:packaged

# Materializza, installa e verifica l'output indipendente
npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated

# Dopo aver estratto e avviato gli ZIP di collaudo sulle porte 4181-4183
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

La scheda Dati propone in termini pratici tre destinazioni: IndexedDB sul dispositivo, una API REST esistente o un backend Node generato. Per le API, l'export legge il token da `VITE_API_TOKEN`; non viene serializzato nel progetto. Il backend generato espone CRUD su `/records`, persiste in `server/data.json` e può aggiungere autenticazione email/password con sessioni firmate, ruoli e aggiornamenti SSE. La prima registrazione crea l'amministratore; le password sono derivate con `scrypt` e i segreti restano nelle variabili d'ambiente. `tests/generatedBackend.test.ts` compila l'app esportata, avvia il server e verifica registrazione, login, autorizzazione, CRUD, persistenza e SSE.

La scheda Pubblica configura con controlli guidati accesso, ruoli, modalità offline, aggiornamenti automatici e nomi delle variabili d'ambiente. Se l'utente abilita l'accesso gestito senza un backend, l'editor segnala il requisito mancante e porta alla procedura per generarlo. Il valore dei segreti non viene mai salvato nel progetto; l'export crea soltanto un `.env.example` vuoto.

Nella stessa scheda, Asset consente di caricare immagini, audio e video fino a 2 MB. I file vengono salvati nel progetto e possono essere assegnati ai relativi componenti dal campo **File del progetto** nell'ispettore; `e2e/assets.spec.ts` verifica upload, preview, salvataggio e riapertura.

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
- L'export usa la prima sorgente/flow dati per il comportamento CRUD MVP e routing hash per le pagine.
- Un progetto importato con `project.frontend-editor.json` è modificabile integralmente. Per cartelle generiche l’HTML statico viene convertito; codice arbitrario di framework viene preservato sotto `original-project/` e richiede conversione progressiva prima che ogni costrutto sia modificabile sul canvas.
- La v2 Codex live ha stato, contesto, screenshot canvas/preview, revision lock, operazioni strutturate, undo, gerarchie annidate con `wrap_component`, job progressivi, cronologia locale, ripristino protetto e terminale persistente. La shell esegue comandi reali e conserva `cd` e stato della sessione, ma non emula ancora programmi TUI che richiedono un PTY completo (per esempio editor terminali a schermo intero).

Stato verificato e matrice dei requisiti: [MVP_STATUS.md](./MVP_STATUS.md).

Percorsi, conteggio delle azioni, difetti corretti, screenshot e limiti osservati dei test A/B/C: [USABILITY_REPORT.md](./USABILITY_REPORT.md).
