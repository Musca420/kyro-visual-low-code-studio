Voglio chiarire la visione principale di Frontend Editor e aggiungere un requisito architetturale importante.

## Sviluppo frontend-first

Normalmente un’applicazione viene progettata iniziando dal backend, dal database o dal modello dei dati, per poi costruire sopra l’interfaccia.

Frontend Editor deve ribaltare questo processo: l’utente deve poter partire dal frontend.

Il flusso ideale è:

1. creo graficamente le schermate;
2. aggiungo pulsanti, form, liste, tabelle e altri componenti;
3. definisco colori, dimensioni, layout, animazioni, responsive design e stati visuali;
4. seleziono un elemento;
5. descrivo in linguaggio naturale cosa deve fare;
6. Codex analizza il componente, il progetto e ciò che manca;
7. propone e realizza flow, modello dati, database, API, backend e test necessari;
8. l’interfaccia grafica rimane la source of truth per l’aspetto e continua a essere modificabile visualmente.

L’obiettivo non è nascondere completamente lo sviluppo, ma permettere all’utente di iniziare dall’esperienza visiva e costruire progressivamente tutto ciò che serve per renderla funzionante.

## Integrazione di Codex nell’applicazione

Voglio integrare Codex direttamente dentro Frontend Editor.

Aggiungi nella parte inferiore dell’editor un pannello apribile e ridimensionabile con:

- terminale integrato;
- sessione Codex;
- cronologia della conversazione;
- stato delle operazioni;
- file modificati;
- diff delle modifiche;
- comandi eseguiti;
- test eseguiti e relativi risultati;
- pulsanti Approva, Rifiuta, Annulla e Ripristina quando applicabili.

Il terminale deve essere aperto nella cartella del progetto attualmente selezionato. L’utente deve poter utilizzare Codex come in un terminale normale, mantenendo però il collegamento con il progetto visuale.

Per una vera integrazione applicativa, valuta prioritariamente il Codex SDK eseguito server-side o nel processo locale dell’applicazione. Il terminale interattivo può rimanere disponibile come superficie aggiuntiva, ma non deve essere l’unico sistema di integrazione.

Non eseguire Codex SDK, shell, PTY o gestione delle credenziali direttamente nel browser. Usa un processo locale/backend controllato con accesso limitato alla cartella del progetto.

## “Chiedi a Codex” sui componenti

Ogni elemento del canvas deve avere nel menu contestuale:

- Chiedi a Codex;
- Crea comportamento;
- Modifica comportamento;
- Collega dati;
- Correggi problema;
- Migliora componente;
- Spiega elemento.

Quando l’utente seleziona un componente o usa il tasto destro su di esso, Frontend Editor deve inviare a Codex un contesto strutturato contenente almeno:

- ID del progetto;
- ID e nome della pagina;
- ID e tipo del componente;
- posizione nell’albero dei componenti;
- proprietà visuali;
- stili e breakpoint;
- stati visuali;
- eventi disponibili;
- flow già collegati;
- binding dati;
- sorgenti dati esistenti;
- file generati corrispondenti;
- dipendenze rilevanti;
- eventuali errori di preview;
- richiesta scritta dall’utente.

Codex non deve dover indovinare a quale pulsante o lista si riferisca l’utente.

Gli ID devono essere stabili. Deve esistere una mappatura verificabile tra componente visuale, modello intermedio, flow e codice generato.

## Esempio operativo

L’utente crea graficamente:

- un input per il nome;
- un pulsante “Aggiungi atleta”;
- una lista degli atleti.

Poi fa clic destro sul pulsante e sceglie “Chiedi a Codex”, scrivendo:

“Quando clicco questo pulsante, aggiungi un nuovo atleta alla lista usando il valore dell’input.”

Codex deve:

1. identificare con certezza pulsante, input e lista;
2. controllare se esiste già un modello Athlete;
3. controllare se esiste una sorgente dati compatibile;
4. rilevare ciò che manca;
5. spiegare sinteticamente il piano;
6. se manca il database, chiedere:
   “Non esiste ancora una sorgente dati per gli atleti. Vuoi crearne una locale oppure collegarne una esistente?”;
7. proporre opzioni semplici e comprensibili;
8. dopo la conferma, creare schema, provider e operazioni necessarie;
9. creare il flow di validazione e inserimento;
10. collegare l’aggiornamento della lista;
11. aggiungere loading, empty state ed error state;
12. aggiornare il modello visuale;
13. rigenerare soltanto ciò che serve;
14. eseguire test;
15. mostrare la modifica nella preview;
16. presentare il diff e il risultato all’utente.

Le operazioni irreversibili, l’installazione di dipendenze, la creazione di servizi esterni e le modifiche sostanziali all’architettura devono richiedere conferma.

## Source of truth e modifiche di Codex

È essenziale evitare che Codex modifichi il codice generato in un modo che renda il progetto incompatibile con l’editor visuale.

Prevedi due percorsi distinti.

### Modifiche visuali strutturate

Quando Codex modifica componenti, proprietà, stili, flow o binding, deve intervenire sul modello intermedio del progetto tramite operazioni tipizzate e validate.

Le modifiche devono essere:

- transazionali;
- validabili;
- annullabili;
- compatibili con undo/redo;
- visibili immediatamente sul canvas;
- registrate nella cronologia.

### Estensioni di codice

Per funzioni non rappresentabili visualmente, Codex può creare moduli personalizzati in aree protette dalla rigenerazione.

Questi moduli devono avere:

- input e output dichiarati;
- interfaccia tipizzata;
- collegamento esplicito al flow;
- test;
- confini chiari;
- indicazione grafica che il comportamento contiene codice personalizzato.

Non promettere una sincronizzazione bidirezionale completa tra codice arbitrario e canvas.

## Strumenti interni per Codex

Crea un livello di integrazione che esponga operazioni sicure e tipizzate, per esempio:

- leggere il progetto corrente;
- ottenere la selezione attiva;
- trovare componenti e pagine;
- creare o aggiornare componenti;
- modificare proprietà e stili;
- creare nodi e collegamenti;
- creare uno schema dati;
- aggiungere un provider;
- collegare dati;
- validare il progetto;
- generare la preview;
- eseguire test;
- esportare il progetto.

Codex dovrebbe preferire queste operazioni strutturate quando lavora sul modello visuale, utilizzando la modifica diretta dei file solo per codice, configurazioni o estensioni che lo richiedono.

## Anteprima e approvazione

Prima di applicare una modifica importante, mostra:

- elemento selezionato;
- richiesta interpretata;
- piano;
- componenti coinvolti;
- dipendenze da installare;
- dati o servizi da creare;
- file e flow interessati;
- eventuali rischi.

Dopo l’esecuzione mostra:

- differenze visuali;
- differenze nel flow;
- diff del codice;
- test eseguiti;
- risultato nella preview;
- possibilità di annullare l’intera operazione.

Una richiesta a Codex deve essere trattata come una transazione unica, così che l’utente possa ripristinare lo stato precedente.

## Autenticazione

Voglio che l’utente possa accedere a Codex con il proprio account come nel Codex CLI.

Usa esclusivamente i sistemi ufficialmente supportati. Per l’esperienza CLI locale, il flusso deve poter avviare `codex login`, aprire il browser per “Sign in with ChatGPT” e lasciare che Codex gestisca la sessione.

Non intercettare, copiare o salvare manualmente token e credenziali. Non memorizzarli nel progetto, nel browser, nel modello visuale o nel repository.

Prevedi anche:

- visualizzazione dello stato di accesso;
- account o workspace attivo, quando disponibile;
- logout;
- sessione scaduta;
- annullamento del login;
- eventuale device-code flow quando il callback locale non è utilizzabile;
- API key come modalità distinta e facoltativa, senza confonderla con l’accesso ChatGPT.

Prima di implementare l’autenticazione, verifica la documentazione aggiornata e i limiti della superficie scelta. Se l’integrazione diretta dell’account non è supportata dal Codex SDK nel modo desiderato, non creare un flusso di login personalizzato: mantieni il login ufficiale del CLI o richiedi una configurazione supportata.

Aggiungi alla visione precedente un requisito fondamentale: Frontend Editor deve includere una skill Codex specifica per comprendere e modificare in tempo reale il progetto visuale aperto.

## Skill Codex dedicata

Crea una skill repo-specific chiamata:

frontend-editor-live

Posizionala nel repository in:

.agents/skills/frontend-editor-live/SKILL.md

La skill deve attivarsi quando l’utente chiede a Codex di:

- osservare la pagina aperta nel Frontend Editor;
- comprendere un componente selezionato;
- modificare posizione, dimensioni o stile;
- creare o cambiare un comportamento;
- collegare un elemento a un flow;
- creare o collegare dati;
- diagnosticare un problema visivo o funzionale;
- confrontare editor, preview e applicazione esportata.

La skill non deve contenere soltanto una descrizione teorica. Deve utilizzare strumenti realmente funzionanti che permettano a Codex di interrogare lo stato live dell’editor.

## Principio fondamentale

La skill non può vedere automaticamente il canvas soltanto perché esiste.

Deve essere accompagnata da un “Frontend Editor Live Bridge”: un servizio locale controllato che esponga a Codex lo stato dell’applicazione tramite strumenti tipizzati.

Implementa preferibilmente questo bridge come server MCP locale oppure, se esiste una soluzione ufficiale più appropriata nell’architettura attuale, documenta e motiva l’alternativa.

La skill deve insegnare a Codex quando e come usare il bridge.

## Cosa deve poter osservare Codex

Codex deve poter ottenere in qualsiasi momento:

- progetto attivo;
- pagina attiva;
- viewport e breakpoint corrente;
- componente selezionato;
- albero completo dei componenti;
- ID stabili;
- tipo e nome dei componenti;
- bounding box e posizione nel canvas;
- dimensioni;
- ordine e livello di annidamento;
- proprietà;
- stili calcolati;
- stili per breakpoint;
- stati hover, focus, active e disabled;
- animazioni e transizioni;
- eventi;
- binding dati;
- flow collegati;
- nodi e connessioni;
- sorgenti dati;
- stato corrente della preview;
- errori di validazione;
- errori JavaScript e di runtime;
- screenshot aggiornato del canvas o della preview.

Codex deve poter combinare due rappresentazioni:

1. rappresentazione strutturata, con componenti, proprietà, coordinate, nodi e collegamenti;
2. rappresentazione visuale, tramite screenshot del canvas o della preview.

Lo screenshot da solo non è sufficiente, perché Codex deve conoscere con certezza gli ID degli elementi. Il JSON da solo non è sufficiente, perché Codex deve poter valutare il risultato visivo.

## Strumenti del Live Bridge

Esponi strumenti equivalenti a:

- `get_editor_status`
- `get_active_project`
- `get_active_page`
- `get_current_selection`
- `get_component`
- `get_component_tree`
- `get_component_layout`
- `get_computed_styles`
- `get_page_flows`
- `get_component_flows`
- `get_data_sources`
- `get_runtime_state`
- `get_validation_errors`
- `get_console_errors`
- `capture_canvas`
- `capture_preview`
- `open_preview`
- `validate_project`

Per le modifiche visuali, esponi operazioni sicure come:

- `move_component`
- `resize_component`
- `set_component_property`
- `set_component_style`
- `set_responsive_style`
- `add_component`
- `remove_component`
- `wrap_component`
- `reorder_component`
- `create_flow`
- `connect_nodes`
- `bind_component_data`
- `create_data_schema`
- `create_data_source`
- `apply_editor_transaction`
- `undo_last_transaction`

I nomi possono cambiare, ma le capability devono essere presenti e chiaramente documentate.

Non esporre una funzione generica che permetta di eseguire codice arbitrario nel processo dell’editor. Preferisci strumenti piccoli, tipizzati, validati e autorizzabili.

## Aggiornamento in tempo reale

Ogni modifica del progetto deve incrementare una revision ID.

Il Live Bridge deve restituire almeno:

- `projectId`;
- `pageId`;
- `revision`;
- `selectedComponentIds`;
- timestamp;
- stato della preview.

Quando l’utente cambia pagina, seleziona un elemento, sposta un componente o modifica un flow, il bridge deve rendere immediatamente disponibile il nuovo stato.

Se MCP non supporta direttamente una sottoscrizione continua nella modalità utilizzata, mantieni internamente una connessione WebSocket o event stream tra editor e bridge, e consenti a Codex di interrogare l’ultima revisione disponibile.

Prima di applicare una modifica, verifica che la revisione su cui Codex ha lavorato sia ancora corrente. In caso contrario, aggiorna il contesto e chiedi a Codex di rivalutare l’operazione, evitando di sovrascrivere modifiche più recenti dell’utente.

## Selezione contestuale

Quando l’utente fa clic destro su un elemento e sceglie “Chiedi a Codex”, crea un context package contenente:

- richiesta dell’utente;
- project ID;
- page ID;
- revision ID;
- component ID;
- percorso nell’albero;
- tipo di componente;
- proprietà e stili;
- bounding box;
- screenshot del componente con contesto circostante;
- componenti vicini;
- eventi e flow;
- binding e sorgenti dati;
- errori correnti;
- riferimenti ai file generati.

Evidenzia visivamente il componente selezionato nello screenshot, senza alterare permanentemente il design.

Il messaggio inviato a Codex deve specificare chiaramente che l’elemento selezionato è il target principale.

## Esempio: modifica visuale

Se l’utente seleziona un pulsante e scrive:

“Sposta questo pulsante sotto il form, allinealo a destra e rendilo più evidente su mobile.”

La skill deve guidare Codex a:

1. leggere la selezione corrente;
2. acquisire struttura e screenshot;
3. controllare parent, layout e breakpoint;
4. identificare il modo corretto di spostarlo senza usare coordinate fragili se il contenitore usa Flexbox o Grid;
5. applicare la modifica tramite operazione strutturata;
6. acquisire un nuovo screenshot;
7. verificare desktop e mobile;
8. controllare overflow, sovrapposizioni e accessibilità;
9. mostrare il risultato e permettere undo.

## Esempio: comportamento e dati

Se l’utente seleziona “Aggiungi atleta” e scrive:

“Questo pulsante deve aggiungere un atleta alla lista”,

la skill deve guidare Codex a:

1. osservare visivamente la pagina;
2. leggere componente, input vicini, lista e flow;
3. controllare sorgenti dati e schema;
4. rilevare che manca un database, se assente;
5. proporre all’utente di crearne uno o collegarne uno esistente;
6. dopo conferma, creare schema e sorgente;
7. creare il flow;
8. collegare input, pulsante e lista;
9. aggiungere validazione, loading, empty ed error state;
10. eseguire il flow nella preview;
11. acquisire uno screenshot del risultato;
12. verificare il modello e i test;
13. permettere di annullare l’intera transazione.

## Workflow obbligatorio della skill

La skill deve istruire Codex a seguire questo ciclo:

1. controllare che Frontend Editor e Live Bridge siano raggiungibili;
2. leggere progetto, pagina, revisione e selezione;
3. acquisire il contesto strutturato;
4. acquisire screenshot quando la richiesta riguarda aspetto o posizione;
5. comprendere la richiesta;
6. ispezionare flow e dati quando riguarda comportamento;
7. presentare un piano se la modifica è sostanziale;
8. applicare modifiche tramite strumenti strutturati;
9. validare il modello;
10. aggiornare la preview;
11. osservare visivamente il risultato;
12. controllare errori e regressioni;
13. correggere se necessario;
14. presentare risultato, test e possibilità di undo.

Codex non deve dichiarare riuscita una modifica visuale senza osservare il risultato aggiornato.

## Struttura della skill

Mantieni `SKILL.md` conciso e procedurale. Usa progressive disclosure.

Struttura consigliata:

.agents/skills/frontend-editor-live/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── references/
│   ├── live-bridge-tools.md
│   ├── project-model.md
│   ├── visual-workflows.md
│   └── security.md
└── scripts/
    ├── check_live_bridge.*
    └── validate_context_package.*

Non creare README o documentazione ridondante dentro la skill.

Il frontmatter di `SKILL.md` deve contenere esclusivamente `name` e `description`. La description deve spiegare con precisione sia cosa fa la skill sia quando deve attivarsi.

Esempio concettuale:

---
name: frontend-editor-live
description: Inspect and modify live Frontend Editor projects using the active canvas, selected components, visual screenshots, flow nodes, bindings, data sources and preview state. Use when Codex is asked to understand, move, style, connect, debug or add behavior to elements in a Frontend Editor project.
---

Adatta il testo alla reale implementazione.

## Sicurezza e autorizzazioni

Il Live Bridge deve:

- accettare connessioni locali o autenticate;
- essere associato a un solo workspace;
- impedire accesso a progetti diversi;
- validare tutti gli input;
- limitare dimensioni e frequenza delle richieste;
- non includere segreti negli screenshot o nei log;
- richiedere conferma per eliminazioni, installazioni e modifiche infrastrutturali;
- non esporre shell generiche tramite gli strumenti visuali;
- supportare transazioni e undo;
- registrare chi ha richiesto e applicato una modifica.

Le operazioni di sola lettura possono essere automatiche. Le operazioni distruttive o con effetti esterni devono richiedere approvazione.

## Test della skill e del bridge

Non considerare la skill completa finché non supera test reali.

Verifica almeno questi scenari:

1. identificare correttamente il componente selezionato;
2. descrivere posizione e aspetto confrontando modello e screenshot;
3. spostare un elemento in un layout Flex;
4. modificare uno stile solo su mobile;
5. creare un’interazione click;
6. leggere i nodi già collegati;
7. rilevare una sorgente dati mancante;
8. creare flow e binding dopo conferma;
9. osservare il risultato nella preview;
10. rilevare e correggere una sovrapposizione;
11. rifiutare una modifica basata su una revisione obsoleta;
12. annullare una transazione;
13. impedire l’accesso a un progetto non autorizzato;
14. gestire editor o bridge non disponibili.

Esegui la validazione formale della skill e testala su richieste realistiche. La skill deve essere inclusa nel repository, così da essere disponibile a chiunque apra Frontend Editor con Codex dalla cartella del progetto.

## Sicurezza del terminale

Un terminale integrato offre accesso reale al sistema e deve essere progettato con attenzione:

- accesso limitato alla directory del progetto;
- sandbox workspace-write come impostazione iniziale;
- approvazione per accessi esterni o privilegi aggiuntivi;
- nessuna esposizione del processo terminale su endpoint pubblici;
- sessioni isolate per utente e progetto;
- protezione contro command injection;
- limiti di risorse e processi;
- terminazione sicura della sessione;
- log privi di segreti;
- nessun comando eseguito automaticamente da contenuti non attendibili.

Se Frontend Editor viene distribuito come servizio web, ogni progetto deve essere eseguito in un workspace isolato. Non collegare una shell del server condiviso direttamente al browser.

## Risultato atteso

Frontend Editor deve diventare un ambiente di sviluppo visuale assistito da LLM nel quale:

- il design viene prima;
- ogni componente può diventare il punto di partenza di una funzione;
- Codex conosce esattamente il contesto visuale selezionato;
- database e backend vengono aggiunti quando richiesti dal comportamento;
- l’utente può lavorare visualmente o dal terminale;
- le modifiche dell’agente rimangono controllabili, verificabili e annullabili;
- grafica, flow, dati e codice restano collegati attraverso un modello strutturato.

Analizza questa visione rispetto all’architettura già realizzata. Spiega quali parti sono già compatibili, quali richiedono modifiche e proponi una roadmap incrementale. Non implementare ancora cambiamenti irreversibili o un sistema di autenticazione personalizzato.

