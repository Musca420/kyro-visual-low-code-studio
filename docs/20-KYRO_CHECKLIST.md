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

- Kyro 2.0 conforme ai Contract e alla Checklist, con tutte le aree DONE.

Attività

- Nessuna attività incompleta nella Checklist.

Rischi

- Il bundle principale dell'editor misura 645,8 kB minificato (190,3 kB gzip); il warning è noto e non ha prodotto regressioni. Una futura ottimizzazione richiede una misura utente, non uno split speculativo.

Decisioni

- Nessuna pubblicazione, firma o installazione di dipendenze esterne è stata eseguita implicitamente. CLI repository-first e desktop locale verificato restano percorsi compatibili; i pacchetti pubblici richiedono firma separata.

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

# Next Cycle

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
