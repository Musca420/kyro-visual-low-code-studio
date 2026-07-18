# Frontend Editor

Editor visuale low-code locale per creare UI responsive, collegare flow deterministici, usare IndexedDB e generare un'app TypeScript/Vite indipendente.

## Avvio

Richiede Node.js 20 o successivo.

```bash
npm install
npm run dev
```

Aprire `http://127.0.0.1:5173`. I progetti e i record sono salvati nell'IndexedDB del browser; non vengono inviati a servizi esterni.

## Verifica

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e

# Materializza, installa e verifica l'output indipendente
npm run export:sample
npm --prefix generated-app install
npm --prefix generated-app run build
npm run test:generated
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
- `vite.config.ts`: Live Bridge locale vincolato al workspace; sincronizza stato/revision ed espone operazioni visuali tipizzate senza shell generica.
- `src/editorOperations.ts`: transazioni validate per proprietà, stili, responsive, componenti, flow, binding e sorgenti dati.
- `src/CodexPanel.tsx`: contesto certo del componente, Codex CLI ufficiale, analisi read-only e approvazione prima dell’applicazione.
- `src/capture.ts`: screenshot PNG del canvas; la preview invia un DOM privo di script e viene rasterizzata fuori dall’iframe senza indebolire la sandbox.

Il modello visuale è la source of truth; il codice è un derivato. Non esiste sincronizzazione bidirezionale con codice arbitrario.

## Esperienza guidata e Codex live

Ogni controllo mostra una spiegazione al passaggio del mouse o al focus. La barra “Prossimo passo” accompagna dalla pagina alla preview. Il clic destro su un componente offre azioni Codex per comportamento, dati, correzione, miglioramento e spiegazione.

Il pannello inferiore mostra target, ID stabile, pagina, revisione, flow, dati e workspace. `Analizza richiesta` esegue `codex exec` in sandbox read-only; solo “Approva e applica” abilita workspace-write. Il login resta quello ufficiale della CLI (`codex login`): l’app non legge o salva token.

La skill repo-specific è in `.agents/skills/frontend-editor-live`. Verifica bridge e contesto con:

```powershell
.\.agents\skills\frontend-editor-live\scripts\check_live_bridge.ps1
.\.agents\skills\frontend-editor-live\scripts\invoke_live_tool.ps1 get_editor_status
```

## Modello e sicurezza

Il formato include metadati, pagine, componenti tipizzati, stili desktop/tablet/mobile, accessibilità, eventi/binding, flow, stato, sorgenti/schema, tema, animazioni, asset, plugin/dipendenze ed export. Gli ID sono stabili e i riferimenti vengono verificati all'import.

Segreti, token e password non appartengono al modello. Il provider MVP non richiede segreti. Import e manifest sono validati; la preview non usa `eval`, non inserisce HTML dinamico non fidato e ha `sandbox="allow-scripts"`. L'eliminazione progetto richiede conferma. I plugin dichiarano permessi ma, nell'MVP, non eseguono codice.

## Android / Capacitor

Ogni export include `capacitor.config.ts`. Dopo la build web:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync
```

In questo ambiente è presente `C:\Users\david\AppData\Local\Android\Sdk`, ma `java` e `adb` non sono nel `PATH`; perciò APK e sync Android non sono verificabili qui senza installare/configurare JDK e platform tools.

## Limiti dichiarati

- Il vertical slice, il provider IndexedDB, l'export web e il plugin di esempio sono completi e reali.
- Il catalogo espone tutti i componenti MVP con modello/stili/eventi/accessibilità; i componenti fuori dal vertical slice hanno rendering semantico di base, non widget avanzati completi.
- Il runtime MVP esegue i nodi del vertical slice; HTTP, autenticazione, database remoti e marketplace remoto sono contributi futuri, non simulati.
- Snap/guide, componenti riutilizzabili avanzati, animazioni visuali e isolamento di codice plugin non attendibile sono fuori dal vertical slice e non vengono dichiarati pronti.
- L'export usa la prima sorgente/flow dati per il comportamento CRUD MVP e routing hash per le pagine.
- La v2 Codex live ha stato, contesto, screenshot canvas/preview, revision lock, operazioni strutturate, undo, gerarchie annidate con `wrap_component` e viste conversazione/operazioni/file/diff/test reali. Restano da completare terminale PTY interattivo, streaming continuo e ripristino dell’intera operazione Codex; non sono simulati.

Stato verificato e matrice dei requisiti: [MVP_STATUS.md](./MVP_STATUS.md).
