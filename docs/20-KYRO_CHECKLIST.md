# KYRO CHECKLIST

Version: 2.0

Status: ACTIVE

Questo documento rappresenta lo stato corrente dello sviluppo.

Il Contract descrive DOVE dobbiamo arrivare.

Questa Checklist descrive DOVE siamo.

L'agente aggiorna esclusivamente questo documento.

Mai il Contract.

---

# Stati

Ogni attività può avere esclusivamente uno di questi stati.

```text
TODO

IN_PROGRESS

VERIFYING

BLOCKED

DONE
```

---

# Regole

Una attività diventa

DONE

solo quando esistono contemporaneamente

- implementazione

- test

- prove

- nessuna regressione

Mai prima.

---

Una attività diventa

VERIFYING

quando

l'implementazione è terminata

ma

test

oppure

prove

non sono ancora complete.

---

Una attività diventa

BLOCKED

solo quando

serve una decisione di prodotto.

Mai per un errore tecnico.

---

# P0

Questa sezione rappresenta il Core.

Nessuna attività P1 può iniziare prima del completamento di P0.

---

## CORE

Status

DONE

Definition of Done

- [x] responsabilità separate

- [x] nessun routing lessicale

- [x] Core autorità

- [x] compatibilità mantenuta

Notes

- `projectCore.applyProjectTransaction` è il confine unico per le mutazioni manuali e Codex dell'editor; valida Graph, progetto, revisione e atomicità, poi incrementa la revisione una sola volta.
- Il resolver usa domini e capability ID tipizzati; il testo libero resta descrittivo e non instrada decisioni.
- Evidenze: `npm run check` (129 test, lint, typecheck e build verdi) e 15 scenari Playwright reali verdi su canvas, dati, flow, history, export, plugin e Graph.

---

## AGENT JOB

Status

DONE

Definition of Done

- [x] Job persistente

- [x] Resume

- [x] Retry

- [x] Cancel

- [x] Restart

- [x] Timeout

- [x] Audit

Notes

- I Job Codex sono persistiti atomicamente in `.kyro/jobs.json`, fuori dal Graph; le transizioni sono replicate in `job-audit.jsonl` append-only.
- Il riavvio classifica i Job attivi come interrotti o scaduti; resume, retry e restart creano tentativi collegati, mentre un retry di un Job completato riusa il risultato senza duplicarlo.
- Evidenze: 4 test unitari di persistenza/restart/timeout/confinamento; scenario Playwright reale con apply, audit, retry idempotente, resume, restart, cancel e controlli UI; screenshot `artifacts/agent-job-recovery.png`.

---

## TRANSACTION ENGINE

Status

DONE

Definition of Done

- [x] idempotenza

- [x] rollback

- [x] retry

- [x] revisione

- [x] autorizzazione

- [x] audit

- [x] test

Notes

- `executeProjectTransaction` serializza le mutazioni, verifica actor/autorizzazione, hash e revisione, e rende il replay dello stesso ID idempotente.
- Progetto, versione e record transazionale vengono salvati nella stessa transazione IndexedDB; manuale, Codex, undo, redo e restore attraversano lo stesso contratto.
- Evidenze: 4 test unitari per replay, race, partial failure, autorizzazione, retry e rollback; test Playwright del ledger persistente e del rollback dopo reload; transazione Codex collegata al Job approvato.

---

## RUNTIME

Status

DONE

Definition of Done

- [x] Runtime Contract

- [x] Preview = Runtime

- [x] Adapter

- [x] Export

- [x] Test

Notes

- `RuntimeProgram` compila una copia validata e profondamente immutabile del Graph; include pagine, componenti, markup, flow, binding, dati, moduli, stato, tema e configurazione, escludendo lo storico operativo.
- Preview e generatori web/PWA/Android consumano lo stesso programma e gli stessi renderer HTML/CSS; gli adapter dichiarano esplicitamente effetti host, web e Capacitor.
- I nuovi flow run persistono nello store IndexedDB `runtimeRuns` con revisione d'origine e non modificano più il Graph; i run legacy restano leggibili.
- Evidenze: 2 test del contratto/parità, 28 test generator, 139 test complessivi, Playwright visuale con flow e reload, export IndexedDB avviato separatamente e 2 export specializzati con flow attivi.

---

## SECURITY

Status

DONE

Definition of Done

- [x] sandbox

- [x] shell

- [x] filesystem

- [x] network

- [x] dependency policy

- [x] secrets

- [x] audit

- [x] test

Notes

- `SecurityPolicy` centralizza budget, origine loopback/same-origin, path canonici, traversal/symlink escape, secret redaction e audit append-only in `.kyro/security-audit.jsonl`.
- Il terminale libero è stato sostituito da un task runner senza shell che accetta solo script locali, npm/pnpm run, TypeScript, Vitest, Playwright, git status e git diff; operatori, eval, rete e installazioni sono rifiutati.
- Codex usa sandbox read-only, strumenti MCP autorizzati, ambiente redatto e budget per processi/rete; una mutazione Live richiede un Job valido o l'origine dell'editor.
- Le dipendenze esterne richiedono approvazione esatta con motivo, versione, licenza, rischio, rollback e piattaforme; la build Android verifica il manifest prima di installare e non usa più `npx` con download implicito.
- Evidenze: 3 test unitari ostili, test UI Security e task runner con screenshot `artifacts/security-policy-denial.png` e `artifacts/terminal-running.png`, audit consentito/rifiutato ispezionato, suite Playwright 51/51 eseguiti (3 skip ambientali), `npm run check` 142/142.

---

## VERIFICATION

Status

DONE

Definition of Done

- [x] validation

- [x] runtime

- [x] behavior

- [x] visual

- [x] build

- [x] evidence

Notes

- Ogni nuova Transaction conserva un `VerificationReport` versionato nel ledger esterno al Graph; gli stadi obbligatori sono scelti da una mappa esplicita operazione-effetti e le operazioni interne sconosciute ricevono il set conservativo completo.
- Validation controlla schema, riferimenti e incremento singolo; Runtime compila la revisione immutabile; behavior verifica flow, binding e moduli; visual verifica il markup derivato; build valida file generati o registra esplicitamente una readiness ancora incompleta durante la configurazione progressiva.
- Ogni stadio passato produce evidenza SHA-256. Un fallimento impedisce il commit atomico e viene persistito con report; undo usa la stessa proiezione Core immediata delle modifiche normali e resta sottoposto a Verification.
- Preview, JSON, file generati e preparazione Android consumano l'ultima revisione verificata, non la proiezione ottimistica dell'editor.
- Evidenze: 3 test dedicati a selezione, hash e fallimenti di tutti gli stadi; rollback senza commit; scenario Playwright con modifica, undo, reload, Preview e ispezione IndexedDB; screenshot `artifacts/transaction-engine-rollback.png`. `npm run check` 145/145 e `npm run test:e2e` 51/51 eseguiti, 3 skip ambientali.

---

## MCP

Status

DONE

Definition of Done

- [x] tool tipizzati

- [x] read

- [x] write

- [x] verify

- [x] plan

- [x] autorizzazione

- [x] audit

- [x] nessun routing lessicale

Notes

- Il registro MCP v1 dichiara per ogni tool schema di input, contratto di output, accesso Read/Write/Verify/Build/Plan, rete solo loopback, assenza di shell ed effetti collaterali.
- Ogni chiamata richiede il token di un Agent Job attivo ed è confinata a progetto, revisione e deadline esatti; il contesto letto proviene dall'ultima revisione verificata e non dallo stato ottimistico.
- Le scritture applicano esclusivamente operazioni approvate attraverso Transaction Engine, Core e Verification; Verify e Build preflight espongono report e readiness senza mutare il Graph.
- Plan usa domini e capability ID tipizzati: il testo descrittivo non seleziona handler tramite parole chiave. Gli alias legacy restano compatibili ma usano la stessa autorità.
- Ogni invocazione viene auditata come started/completed/denied e consuma il budget del Job. Evidenze: 3 test MCP su processo reale (contratto, no-auth, progetto/revisione/deadline/budget), scenario browser su report verificato e build preflight, `npm run check` 146/146, stress Flow 10/10 e Playwright 51/51 con 3 skip ambientali.

---

# P1

Questa sezione migliora il prodotto.

Non modifica il paradigma.

---

## CAPABILITY

Status

DONE

Definition of Done

- [x] lifecycle

- [x] contract

- [x] activation

- [x] versioning

- [x] migration

- [x] prove

Notes

- `CapabilityContract` v1 dichiara porte tipizzate, effetti, permessi, dipendenze con approvazione, piattaforme e implementazione versionata; lo stesso contratto descrive capability globali e adapter native esistenti.
- Il lifecycle supporta draft, testing, active, deprecated, blocked e rejected. Lo schema rifiuta qualsiasi record active privo di implementazione verified, tutte le prove richieste, prova runtime e, quando previsto, approvazione esplicita.
- Ogni nuova registrazione crea una versione immutabile con ID record distinto, capability ID stabile e incremento minor; la versione precedente resta disponibile. Migrazione parte blocked, diventa compatible solo dopo activation verificata e conserva passi e rollback version.
- I record legacy restano importabili ma un legacy active senza contratto viene migrato a blocked fino a riverifica. Il resolver riusa solo versioni active che superano il contratto.
- Evidenze: 3 test lifecycle su activation, record contraffatto, versioning, migrazione e rollback; registry native contrattualizzato; test MCP della proposta esatta; scenario browser con due versioni, chiusura/riapertura e screenshot `artifacts/capability-version-lifecycle.png`.

---

## OPEN MODE

Status

DONE

Definition of Done

- [x] limitation

- [x] resolution

- [x] approval

- [x] implementation

- [x] verification

- [x] registration

Notes

- Ogni sessione Open Mode persiste limite, risoluzione, approvazione, implementazione, verifica e registrazione come stati ed eventi tipizzati esterni al Graph; nessun passaggio dichiara un successo simulato.
- I moduli confinati attraversano la stessa Transaction e Verification del progetto. Test del modulo, report runtime e hash diventano prove; solo allora capability e implementazione globale vengono salvate atomicamente e attivate.
- Un pacchetto esterno richiede nome npm esatto, versione, licenza, rischio, rollback e piattaforme. Una descrizione vaga viene rifiutata e l'approvazione non installa automaticamente nulla; i gap non risolti restano limitazioni esplicite.
- Sessioni e implementazioni sono persistenti, incluse in backup/restore e riutilizzabili globalmente. Evidenze: 3 test dedicati, scenario browser con reload e screenshot `artifacts/open-mode-verified-module.png`; `npm run check` 153/153 e suite Playwright 53/53 eseguiti, 3 skip ambientali.

---

## PRODUCT CONSISTENCY

Status

DONE

Definition of Done

- [x] stesso Graph

- [x] stessi Component

- [x] stessi Flow

- [x] stessa Preview

- [x] stesso Export

- [x] zero AI leakage

- [x] round trip

Notes

- `ProductConsistency` confronta ad ogni Verification Graph e Runtime: identità/revisione, pagine, componenti, markup, flow, binding, dati, moduli, stato, tema e configurazione. Il generator rifiuta un export se questo contratto non passa.
- Le snapshot portabili separano il prodotto da identità, timestamp, provenance e cronologia runtime. Manuale e Codex con le stesse operazioni producono lo stesso Graph; i metadati Job/Transaction restano nei ledger esterni e non entrano nel Runtime o nell'export.
- L'import esatto conserva ora il nome applicativo e assegna soltanto un nuovo ID di progetto, evitando collisioni senza cambiare titolo/package del prodotto. Component ID, flow, dati, Preview runtime, HTML e secondo export restano equivalenti.
- Evidenze: 3 test dedicati, `npm run check` con 156/156, scenario browser manuale + Job Codex + Preview + due export + reimport, screenshot `artifacts/product-consistency-round-trip.png`; suite Playwright 54/54 eseguiti, 3 skip ambientali.

---

## UX

Status

DONE

Definition of Done

- [x] piano

- [x] impatto

- [x] autorizzazione

- [x] verifica

- [x] undo

- [x] coerenza

Notes

- Il piano Codex usa ora linguaggio semplice: cosa cambia, aree coinvolte, elemento/pagina/revisione, limiti dell'autorizzazione e verifiche previste. Operazioni e file tecnici restano disponibili nelle viste avanzate ma non invadono il percorso principale.
- La review card riceve focus quando appare, Escape equivale a Reject e nessuna modifica precede l'approvazione. Dopo l'apply, il Verification Report della Transaction mostra stadi passati, numero di prove hashate, revisione e Undo nello stesso contesto.
- La card è ancorata al viewport, scrollabile, accessibile e coerente su desktop/mobile e tema chiaro/scuro; i risultati Codex vengono riassunti senza mostrare JSON grezzo.
- Evidenze: test unitario del summary tipizzato; scenario browser con rifiuto da tastiera, seconda approvazione, verifica, mobile e undo; screenshot `artifacts/codex-approval-light.png` e `artifacts/codex-controlled-change-mobile.png`; `npm run check` 157/157 e Playwright 55/55 eseguiti, 3 skip ambientali.

---

## ARTIFACT REGISTRY

Status

DONE

Definition of Done

☑ hash

☑ provenance

☑ report

☑ screenshot

☑ trace

☑ build

Notes

- Registro esterno al Graph in IndexedDB v8 con contenuti fino a 10 MB, SHA-256 ricalcolato e identità content-addressed derivata da progetto, tipo, contenuto e provenance.
- Report di ogni Transaction vengono salvati atomicamente con commit/fallimento; screenshot e trace Codex collegano Job, Transaction e revisione; build/export collegano il record esportato.
- La tab Evidence verifica ogni record prima di mostrarlo. Backup/restore conserva il registro e rifiuta integralmente artefatti corrotti; retry identici riusano lo stesso ID senza duplicare prove.
- Evidenze: 2 test unitari su cinque tipi, hashing, replay, corruzione di contenuto/provenance e restore rifiutato; test backup round-trip; percorso browser Codex con report, screenshot, trace, build ed export; screenshot `artifacts/artifact-registry.png`. `npm run check` 159/159 e Playwright 55/55 eseguiti, 3 skip ambientali.

---

# P2

Questa sezione certifica il prodotto.

---

## DEMO A

Status

DONE

Definition of Done

☑ progetto esistente

☑ modifica manuale

☑ modifica Codex

☑ export

☑ test

Notes

- La fixture React esistente viene importata dalla cartella tramite l’interfaccia e convertita staticamente senza eseguirne il codice.
- Il titolo viene modificato manualmente; Codex cambia la CTA mediante Job, piano approvato, Transaction e Verification sulla stessa revisione.
- Preview ed export standalone mostrano `Kyro Certified Portfolio` e `Explore the certified work`; lo ZIP non contiene Job ID o marker `approved_job`.
- Evidenze: `e2e/demo-a.spec.ts`, `artifacts/demo-a-existing-project.zip`, screenshot `artifacts/demo-a-standalone.png`; `npm run check` 159/159, Playwright 56/56 eseguiti con 3 skip ambientali.

---

## DEMO B

Status

DONE

Definition of Done

☑ Web App esistente

☑ modifica globale

☑ preview

☑ export

☑ test

Notes

- Una Landing Web App multipagina viene completata con flow, salvata, chiusa e riaperta come progetto esistente prima della modifica.
- Il token visuale globale `pageBackground` viene cambiato dalla UI; Home e Pricing mostrano lo stesso colore in Preview e nel processo standalone.
- Il primo tentativo di export senza flow è stato correttamente bloccato dal preflight con un messaggio comprensibile; il test riparte da zero e completa il requisito visualmente.
- Evidenze: `e2e/demo-b.spec.ts`, `artifacts/demo-b-global-web-app.zip`, screenshot `artifacts/demo-b-global-standalone.png`; `npm run check` 159/159 e Playwright 57/57 eseguiti, 3 skip ambientali.

---

## DEMO C

Status

DONE

Definition of Done

☑ nuova applicazione

☑ almeno quattro pagine

☑ flow

☑ dati

☑ responsive

☑ runtime

☑ export

☑ prove

Notes

- Creata dalla UI una Management App con Overview, Projects, Reports e la nuova pagina Team; configurati una sorgente IndexedDB e sette flow visuali.
- Il runtime Preview crea e persiste un record reale, aggiorna KPI e tabella, mantiene i dati dopo chiusura e riapertura e mostra la navigazione mobile adattiva.
- L'export contiene quattro route, sette flow e la sorgente dati; il processo standalone esegue lo stesso CRUD reale.
- Evidenze: `e2e/demo-c.spec.ts`, `artifacts/demo-c-four-page-app.zip`, `artifacts/demo-c-mobile-runtime.png`, `artifacts/demo-c-standalone-runtime.png`; `npm run check` 159/159 e Playwright 58/58 eseguiti, 3 skip espliciti.

---

## RELEASE

Status

DONE

Definition of Done

☑ changelog

☑ version

☑ evidence bundle

☑ rollback

☑ no regression

Notes

- `CHANGELOG.md` descrive Kyro 2.0.0, sicurezza e compatibilità; `package.json`, lockfile e CLI riportano la stessa versione.
- `release/kyro-2.0.0-evidence.zip` contiene prove con manifest SHA-256; `npm run release:verify` controlla metadati, rollback e ogni byte del bundle.
- Il tarball CLI è stato installato da zero e collaudato con browser visibile: Canva, landing, dashboard, cinque record creati in Preview, CRUD, responsive, riapertura, export e Ask Codex autentico con undo sono verdi.
- Export Android rigenerato, compilato e installato con `adb install -r` su emulatore e telefono fisico; l'app avviata mostra la richiesta permesso nativa prevista dal Graph.
- Corretti tre difetti osservati come utente: conflitto React dello sfondo, Preview aperta prima della revisione verificata e tarball che includeva file locali non necessari.
- `ROLLBACK.md` mantiene intatto il checkout corrente, usa il precedente tag v0.1.15 in un checkout separato e richiede backup/hash degli artefatti.
- Regressione finale: `npm run check` 161/161; Playwright principale 58/58 eseguiti con 3 skip espliciti; export generico 1/1, specializzati 2/2 e desktop packaged 1/1 eseguiti separatamente.
- Export Android sorgente rigenerato e coperto da generator/security test; una nuova installazione di dipendenze native non è stata avviata implicitamente, in conformità alla Dependency Policy. Restano valide le prove APK/device già registrate.
- Benchmark ripetuto graph-context vs repository-first: due prompt identici, stesso GPT-5.6/reasoning/machine, 3 prove read-only per cella. Kyro registra mediane 3,05× e 3,23× più rapide e 92,0%/92,6% token in meno; prompt, valori e limiti sono pubblicati senza claim universali.
- Corretto il difetto UX per cui un Job `running` con output non ancora disponibile mostrava “Codex returned no text.”: ora resta “Analysis in progress…” e solo un completamento realmente vuoto genera un errore ritentabile. Test Playwright 1/1 e richiesta autenticata live con apply/Preview/undo PASS.
- README, submission copy e copione umano aggiornati secondo le regole Devpost; nuovo montaggio verificato di 167,5 secondi pronto per la registrazione vocale dell'entrante.

---

# Current Focus

Una sola attività può essere

IN_PROGRESS.

Current Focus

- COMPLETE

---

# Current Sprint

Obiettivo

- Kyro 2.1 conforme ai Contract e alla Checklist, con benchmark riproducibile, installazione fresca, build Android reale e pubblicazione GitHub.

Attività

- Nessuna attività incompleta nella Checklist.

Rischi

- Il bundle principale dell'editor supera 500 kB minificato; il warning è noto e non ha prodotto regressioni. Una futura ottimizzazione richiede una misura utente, non uno split speculativo.

Decisioni

- La pubblicazione `v2.1.0` è stata autorizzata esplicitamente. Il percorso supportato è la CLI repository-first; il canale desktop Electron non funzionante resta rimosso.

---

# Last Cycle

Area

- RELEASE

Gap Analysis

- Current: tutte le aree e demo erano certificate, ma manifest 0.1.15, changelog, rollback e bundle Release mancavano. Problem: le prove ignorate e una suite verde non costituivano una release riproducibile; i test export materializzati non verificavano una build pulita. Target: Kyro 2.0.0 versionato, reversibile e verificabile byte per byte. Plan: sincronizzare i manifest, documentare cambi e rollback, creare un bundle deterministico e collaudare CLI, Web, Android source e desktop.

Decisioni

- Riutilizzati JSZip, SHA-256 e script esistenti senza dipendenze nuove. Il flow runtime esportato usa adapter tipizzati per accettare lo stesso contratto dati in app generiche e specializzate. Il percorso Android non scarica pacchetti senza approvazione.

File modificati

- `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `ROLLBACK.md`, `.github/workflows/verify.yml`, `scripts/release-evidence.mjs`, `tests/release.test.ts`, `src/generator.ts`, `tests/generator.test.ts`, `e2e-generated/generated-app.spec.ts`, `release/evidence-manifest.json`, `release/kyro-2.0.0-evidence.zip`, `docs/20-KYRO_CHECKLIST.md`.

Test

- `npm run check`: PASS, typecheck, lint, 162 test in 39 file e build.
- `npm run test:e2e`: PASS, 58 scenari eseguiti; 3 skip espliciti. `npm run desktop:test:packaged`: 1/1 PASS.
- Export: typecheck Web generico e specializzati PASS; `npm run test:generated` 1/1 e `npm run test:specialized` 2/2 PASS; Android source generation PASS.
- `npm run release:verify`: 2/2 PASS; CLI `--version` = 2.0.0, `--check --home` PASS; `npm pack --dry-run` PASS.
- Fresh install: scenari visuali Canva 1/1 e Landing+Dashboard 1/1 PASS; Ask Codex installato PASS con 5.244 B di contesto, piano 17,009 s, apply 1,674 s, 18.468 token e undo verificato.
- Android: `assembleDebug` PASS (248 task); `adb install -r` PASS su emulatore e telefono fisico; avvio `studio.kyro.nativeverification` PASS.

Prove

- Bundle `release/kyro-2.0.0-evidence.zip` e `release/evidence-manifest.json`; package desktop `desktop-dist/Kyro-win32-x64`; export in `generated-app`, `out/experience-*` e `out/native-verification`; screenshot demo inclusi nel bundle.

Compatibilità

- Project format 1, migrazioni, Graph, Transaction, Verification, Security, Preview, Web/PWA/Android export, CLI e shell desktop restano compatibili. Demo A/B/C e product round trip sono verdi dopo le correzioni Release.

Problemi

- Trovati e corretti: test export non aggiornato ai default English-first; preview specializzata senza build `dist`; firme TypeScript incompatibili tra runtime flow e adapter specializzati. Il typecheck Android isolato richiede moduli Capacitor non installati e resta deliberatamente non eseguito senza approvazione dependency/network.
- Submission hardening: corretto il placeholder live Codex durante il polling; confermato che il resolver non usa parole del prompt per il routing, ma domini, capability ID, tipi ed effetti dichiarati. Un test di non-regressione dimostra che prompt semanticamente opposti producono la stessa risoluzione a parità di contesto tipizzato. `npm run check` 162/162, resolver 5/5, test UX 1/1, suite browser 58 PASS con 3 skip espliciti e smoke Codex autentico live PASS.
- Evidenza aggiunta: benchmark a 12 run, grafico accessibile, runner riproducibile, README judge-first e cut video silenzioso da 167,5 secondi. L'audio umano e l'upload YouTube restano azioni esterne dell'entrante e non sono dichiarati completati.

---

# TOOL AND CAPABILITY STABILITY CYCLE (2026-07-21)

Area

- Agent registry, typed planning, Capability Resolver, MCP, native contracts and installed-CLI UX.

Gap Analysis

- Current: Graph, Transaction, Verification and Security were stable, but schema, prompt and MCP duplicated parts of the contract; `argsJson` deferred failures; the resolver confused available operations with proven coverage. Problem: accepted plans could fail late (`invalid index`, invalid API schema, unrecognized plan). Target: one authoritative registry, typed requirements, honest platform results and verified apply. Plan: `KYRO_TOOL_CAPABILITY_STABILITY_PLAN.md` implemented without rewriting stable subsystems.

Decisioni

- `src/agentRegistry.ts` is the single source for 42 operations: Zod arguments, description, effects, permissions, platforms, support, prerequisites, verification, limits and confirmation.
- New plans use object `args`; `argsJson` remains read compatibility only. Every operation is validated before approval. Controlled defaults apply only to harmless planner metadata.
- Resolver routing uses only typed `operation/capability/effect` IDs and target platforms. It returns `supported`, `composable`, `partial`, `unsupported` or `unknown`, with covered, missing and blocked requirements.
- The complete JSON schema remains the local validation contract. It is not sent as API `response_format`, because the API strict subset rejects the dynamic objects required by style, binding and patch operations. Returned JSON is validated locally before authorization.
- `kyro_describe_tools` exposes the generated catalog. File, Bluetooth, push, location and clipboard actions now declare typed input/output, prerequisites and errors. Global capabilities require runtime evidence for the requested platform.

File modificati

- Registry, plan parser, resolver, capability/native contracts, MCP bridge, Codex UI state, Open Mode evidence, runtime/editor regression fixes and their focused tests.

Test

- `npm run check`: PASS; typecheck, lint, 220 tests in 40 files and production build.
- Operation matrix: every registered operation executed; atomic mixed failure; every reorder permutation for 2-8 siblings with index and stable sibling IDs.
- MCP, registry, resolver, lifecycle, security, transaction and verification suites: PASS.
- Real Codex CLI: reproduced two `invalid_json_schema` API failures, then verified a raw typed JSON plan with stable IDs, `args`, requirements and target platform.
- Fresh global CLI tarball tested in a visible browser using real clicks: Home/recent project -> Design -> select heading -> context-menu Ask Codex -> Analyze -> approve -> apply -> Home -> reopen -> Preview.

Evidenze

- Installed transaction `c8a675f1-b145-4769-827d-ff817706f2aa`: plan 20.187 s, verified apply 0.522 s, no console errors.
- Repeated installed flow changed `Make progress visible.` to `Design with certainty.`, advanced the revision, reopened the project from Home and showed the persisted result in Preview.
- Screenshots: `artifacts/stability/stability-04-01-installed-home.png` through `artifacts/stability/stability-04-05-reopened-preview.png`.

Compatibilita'

- No direct Graph mutation. Transaction Engine, revision authorization, Verification, Preview, audit and undo remain the application boundaries. Existing project format and historical `argsJson` plans remain readable.

Problemi aperti

- Known Vite warning for the main chunk over 500 kB; no functional regression observed.
- Visual testing found and fixed two blocking UX issues: harmless plan metadata was too rigid, and the approval dialog stayed open after a completed apply. The repeated path has no observed blocker.

Prossimo passo

- No TODO remains in the stability plan. Git publication remains a separate explicitly authorized action.

---

# MONOLITH AND DEPENDENCY HARDENING CYCLE (2026-07-21)

Area

- Confini applicativi, Verification, dipendenze, CI e pacchetto CLI.

Stato

- DONE

Gap Analysis

- Current: comportamento e Graph erano stabili, ma Live Bridge viveva in `vite.config.ts`, generator e UI concentravano responsabilità e la toolchain desktop non supportata introduceva 25 advisory. Problem: modifiche locali caricavano confini troppo ampi; Verification produceva falsi negativi per flow, eventi, intenti e nomi dei layer; l'installer desktop non funzionava. Target: estrazioni meccaniche, stessa API pubblica, verifica pertinente agli effetti e un solo canale installabile supportato. Plan: spostare un confine alla volta, caratterizzare ogni output, rimuovere Electron su richiesta esplicita, verificare CI, pacchetto e uso visuale installato.

Decisioni

- `vite.config.ts` contiene soltanto la configurazione Vite e registra `server/liveBridge.ts`; URL, status, payload, autorizzazione, deadline e audit delle route restano invariati.
- Preview ed export continuano a usare l'unico renderer puro in `runtimeProgram.ts`; sono state eliminate implementazioni legacy irraggiungibili, senza creare un secondo renderer.
- Il generator mantiene la stessa API e gli stessi file prodotti, separando backend generato, capacità native e runtime flow in moduli foglia.
- Da `App.tsx` sono stati estratti chrome e console flow; da `CodexPanel.tsx` parser output e lista trace. Stato, polling e lifecycle restano negli orchestratori.
- Verification osserva ora anche nome, eventi e intento mostrati dall'editor. Le modifiche flow non emettono `set_page_components` quando gli eventi non cambiano; il Plugin Manager non emette aggiornamenti tema no-op.
- Electron, Forge, installer, update/signing desktop, workflow, test e dipendenze sono stati rimossi. Web, PWA, Android, CLI, Graph, Transaction, Verification, Security e rollback non sono cambiati.

File modificati

- `server/liveBridge.ts`, `vite.config.ts`, `src/generator.ts`, `src/generator/backendFiles.ts`, `src/generator/nativeFiles.ts`, `src/generator/flowRuntime.ts`, `src/PreviewFrame.tsx`, `src/App.tsx`, `src/editor/EditorChrome.tsx`, `src/editor/flow/*`, `src/CodexPanel.tsx`, `src/codex/*`, `src/verification.ts`, `tests/verification.test.ts`, `package.json`, `package-lock.json`, `.github/workflows/verify.yml`, `README.md`, `SECURITY_DEPENDENCY_STATUS.md` e rimozioni desktop dedicate.

Test

- `npm run check`: PASS; typecheck, lint, 220/220 test in 39 file e build production.
- `npm run test:e2e`: PASS; 55/55 scenari eseguiti, 2 skip ambientali dichiarati.
- Test mirati generator/runtime/Preview/native/backend: PASS, inclusi 34 golden test di parità dopo le estrazioni.
- Audit completo: 0 advisory su 439 dipendenze. Audit runtime: 0 advisory su 197 dipendenze di produzione.
- Pacchetto: `npm pack` produce 95 file, 258.591 byte compressi, 1.086.524 byte estratti e zero dipendenze bundled; install pulito locale, `kyro --version` = 2.0.0 e `kyro --check` PASS.

Evidenze

- Test visuale sul pacchetto installato e sulla cartella `e2e/fixtures/react-import`: Design → selezione titolo → menu contestuale Ask Codex → piano tipizzato → approve/apply → reload → Preview.
- Risultato persistito: `Portfolio React` → `Release path verified.`; nessun errore console e nessuna risposta HTTP fallita.
- Screenshot: `artifacts/stability/monolith-hardening-clean-01-installed-home.png` fino a `monolith-hardening-clean-05-reopened-preview.png`.
- Dimensioni dopo l'estrazione: `vite.config.ts` 12 righe, `generator.ts` 648, `PreviewFrame.tsx` 495, `CodexPanel.tsx` 771, `App.tsx` 5.046. Nessun file è stato diviso per una soglia arbitraria.

Compatibilità

- Project format, migrazioni, autosave, import cartella, CLI, Preview, export Web/PWA/Android, Codex/MCP, capability, undo e audit restano compatibili. La vecchia chiave workspace desktop è letta solo come fallback di migrazione.

Problemi aperti

- Il warning Vite sul chunk principale oltre 500 kB resta noto e non produce regressioni osservate.
- La cartella repository completa supera intenzionalmente il limite di import 500 file/4 MB; il collaudo installato usa una cartella progetto rappresentativa sotto il limite.
- Nessun canale desktop è supportato o distribuito. Il percorso pubblico documentato è `kyro` da terminale.

Prossimo passo

- Ripetere i 10 benchmark Kyro vs Codex CLI sulla nuova baseline; non fanno parte di questo ciclo di hardening.

---

# Next Cycle

---

# RELEASE 2.1 AND TEN-PROMPT BENCHMARK CYCLE (2026-07-21)

Area

- Release, benchmark comparativo, installazione CLI, export Web e build Android.

Stato

- DONE

Gap Analysis

- Current: il ciclo di hardening era verde, ma mancavano il confronto cumulativo sui dieci prompt, una nuova installazione del pacchetto 2.1 e una build Android eseguita dalla UI corrente. Problem: i risultati precedenti non dimostravano la release aggiornata end-to-end e il percorso Android poteva fallire senza feedback rapido. Target: stesso progetto e stessi prompt per Kyro e Codex CLI, prove raw pubblicate, pacchetto installato da zero, Preview/export verificati e APK reale. Plan: ricreare la baseline visualmente, eseguire entrambi i runner, correggere soltanto difetti generali riproducibili, poi eseguire suite, packaging e pubblicazione.

Decisioni

- Il benchmark non viene presentato come vantaggio universale di latenza o token: Kyro completa 10/10 richieste con transazioni verificate; la CLI isolata completa 0/10 perché non possiede selezione, Graph e strumenti Kyro. La CLI è più rapida nel rispondere e usa leggermente meno token totali.
- Il risultato CLI con exit code zero ma nessuna modifica non è conteggiato come successo funzionale. Hash baseline, output finali, prompt, raw run e metodologia sono pubblicati.
- `@capacitor/app` e `@capacitor/status-bar` alle versioni esatte generate da Kyro sono dipendenze Capacitor ufficiali già revisionate. Pacchetti sconosciuti continuano a richiedere approvazione esatta.
- I progetti senza flow espongono un fallback `runGraph` tipizzato: il runtime CRUD resta compilabile e un riferimento corrotto fallisce esplicitamente, senza introdurre un secondo runtime.
- Il test Android rileva immediatamente un rifiuto UI prima della creazione del job; non attende più quindici minuti simulando un blocco.

File modificati

- Registry e operazioni agente, resolver/capability, MCP, editor/flow, Preview/runtime/export, `server/liveBridge.ts`, `src/generator.ts`, test operazioni/generatore/Android, runner e report benchmark, README/Devpost/compliance/changelog/rollback, immagini e bundle Release.

Test

- Kyro: 10/10 prompt pianificati, approvati e applicati; checkpoint headed con validazione/focus, due date, filtri, empty state, desktop/mobile, reload e persistenza PASS; console/runtime errori zero.
- Export Web: ZIP estratto, dipendenze installate, build production e runtime indipendente PASS; due date e persistenza confermate.
- Codex CLI PowerShell: stessi dieci prompt e stessa baseline byte-identica; 10/10 processi exit zero, 0/10 modifiche funzionali, output SHA-256 invariato.
- Benchmark Kyro: 509.546 ms totali, mediana 44.804 ms, 784.271 token. CLI: 274.656 ms totali, mediana 27.002 ms, 763.568 token.
- Android headed: generazione da Publish, dipendenze, build Vite, `cap add`, configurazione, `cap sync`, Gradle `assembleDebug` e APK 4.144.292 byte PASS; manifest, permessi, versione, orientamento, keyboard resize, tema e stato UI verificati.
- Pacchetto CLI 2.1.0: installazione pulita, `kyro --version`, `kyro --check --home`, creazione visuale, Preview, reload e riapertura con persistenza PASS.
- Regressione Playwright completa sulla workstation preparata: 55 PASS, 2 gate; su runner pulito il reimport della sorgente Android generata è un terzo gate esplicito. I test non assumono più account Codex, separatori Windows o nomi locali di cartella.

Evidenze

- `docs/benchmarks/2026-07-21-kyro-vs-codex-cli-10-results.json`, raw run e protocollo; `docs/images/kyro-vs-codex-cli-10.svg`; screenshot desktop/mobile.
- `docs/images/kyro-2.1-fresh-install.png` e `docs/images/kyro-android-build-verified.png`.
- `release/kyro-studio-2.1.0.tgz`, `release/kyro-2.1.0-evidence.zip`, manifest SHA-256 e video silenzioso locale da 167,5 secondi.
- Release pubblica: `https://github.com/Musca420/kyro-visual-low-code-studio/releases/tag/v2.1.0`.

Compatibilità

- Project format 1, Graph unico, Transaction Engine, Verification, Security, undo, progetto importato, CLI, Preview ed export Web/PWA/Android restano compatibili. Nessuna mutazione diretta del Graph e nessun bypass di sicurezza sono stati introdotti.

Problemi aperti

- Il warning Vite sul chunk principale oltre 500 kB resta noto e non ha causato regressioni osservate.
- Firma store Android, registrazione vocale umana, upload YouTube e invio Devpost restano azioni esterne dell'entrante; non sono dichiarate completate.

Prossimo passo

- Registrare la voce umana indicata in `testo.md`, caricare il video su YouTube e completare il form Devpost.

L'agente deve iniziare sempre dalla prima attività

TODO

oppure

VERIFYING

più alta nella lista.

Mai scegliere liberamente.

Mai saltare priorità.

---

# Final Rule

La Checklist rappresenta lo stato del progetto.

Il Contract rappresenta l'obiettivo.

La Checklist cambia continuamente.

Il Contract quasi mai.
