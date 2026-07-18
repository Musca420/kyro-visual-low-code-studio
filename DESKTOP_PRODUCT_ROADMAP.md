# Desktop product roadmap

Questa estensione è parte vincolante della Definition of Done complessiva insieme a `PROJECT_SPEC.md` e `aggiunta.md`. Frontend Editor non è completo finché UI, installazione, avvio, persistenza ed esperienza end-to-end non sono state provate realmente.

## Decisione desktop: Electron

Tauri 2 è stato valutato per primo. Offre bundle multipiattaforma e aggiornamenti firmati, ma l'architettura corrente dipende intenzionalmente da servizi Node locali: Live Bridge, processi Codex, terminale persistente, import di cartelle, generatori ed export. In Tauri questi servizi richiederebbero comunque un sidecar Node auto-contenuto oltre alla shell Rust; inoltre la macchina di sviluppo corrente non dispone di Rust/Cargo. Questo duplicherebbe runtime, build e superficie di debug senza eliminare Node.

Electron viene quindi scelto per il primo prodotto desktop perché consente di riusare lo stesso bridge Node e lo stesso renderer React/Vite. Il renderer web, il formato JSON e gli export restano indipendenti da Electron: la scelta non introduce lock-in nei progetti creati. La sicurezza minima obbligatoria è `contextIsolation`, renderer senza accesso Node, sandbox, CSP, IPC ristretto e nessuna navigazione esterna implicita.

Gli aggiornamenti desktop devono usare artefatti firmati. Windows e macOS possono usare il meccanismo `autoUpdater`; Linux segue il package manager o un canale AppImage firmato. La pubblicazione e firma pubblica restano verificabili soltanto quando esistono identità/certificati di release, ma il prodotto deve rifiutare pacchetti non appartenenti al canale configurato.

## Matrice di accettazione

| Area | Requisito | Criterio verificabile | Stato |
|---|---|---|---|
| Identità | Palette neutra scura, accenti semantici UI/dati/flow/errori, chiaro/scuro | Screenshot desktop/mobile; contrasto testo normale almeno 4.5:1; preferenza persistente | Base verificata |
| Canvas | Pannelli ridimensionabili e progressive disclosure | Resize desktop; a 760 px nessun overflow e inspector non copre il canvas | Base verificata |
| Accessibilità | WCAG 2.2 AA nei percorsi principali | Tastiera, focus visibile, nomi accessibili e audit automatico/manuale | In corso |
| Home | Recenti, ricerca, template, backup e ripristino | Chiudere/riaprire, cercare, esportare backup, cancellare/ripristinare senza perdita | Verificato |
| Desktop | Avvio da icona su Windows/macOS/Linux | Bundle prodotti in CI per i tre sistemi; installazione e smoke test nativo per sistema | Windows verificato; macOS/Linux da eseguire sui sistemi target |
| CLI | `frontend-editor [cartella]` globale | Installazione locale del comando, apertura cartella valida, errore comprensibile per percorso non valido | Verificato su Windows |
| Persistenza | Progetti, cronologia, conversazioni, versioni ed export | Riavvio del processo desktop conserva ogni elemento; backup/restore round-trip | In corso |
| Aggiornamenti | Canale firmato, rollback/rifiuto pacchetto invalido | Test manifest/versione/firma; prova reale dopo disponibilità certificati e hosting | Da fare |
| Codex | Contesto live, transazione, before/after, test e undo | Timeline persistente con screenshot e revisione; rollback atomico riprovato | In corso |
| Apertura | Formato locale/versionabile, import cartella, export web/Android | Progetto continua fuori dall'editor e file non convertiti non vengono persi | Base verificata |

## Ordine di consegna

1. Design system, temi, responsive e accessibilità.
2. Shell Electron sicura e CLI globale con apertura cartella.
3. Home persistente con ricerca, template, backup e ripristino.
4. Timeline Codex persistente e annullabile con osservazione visuale.
5. Plugin/provider estendibili, export web/Android e aggiornamenti firmati.
6. Cinque sessioni persona “Canva, zero coding”, seguite da audit completo delle Definition of Done.

## Evidenze del verticale Windows

- `npm run desktop:package`: pacchetto x64 prodotto e avviato separatamente.
- `npm run desktop:make`: installer Squirrel `FrontendEditor-0.1.0 Setup.exe` prodotto (145.320.448 byte nella prova del 18 luglio 2026).
- Installazione silenziosa conclusa con exit code 0; creati collegamenti Desktop e Start Menu.
- Smoke test dell'eseguibile installato: apertura cartella, conversione HTML/CSS e rendering sul canvas superati.
- Sicurezza verificata dal test: `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`; audit delle dipendenze runtime: 0 vulnerabilità note.
- Dopo una successiva ricostruzione, Device Guard ha rifiutato il nuovo hash non firmato (exit code 4551). Il renderer di produzione aggiornato viene quindi testato con il runtime Electron locale autorizzato; la distribuzione del nuovo artefatto richiede un certificato di firma Windows e resta esplicitamente aperta.
- `e2e/backup-restore.spec.ts`: progetto e record creati esclusivamente dalla UI, backup scaricato e ispezionato, progetto eliminato, restore eseguito e record verificato nuovamente in Preview; ricerca e contrasto della card recente inclusi.
