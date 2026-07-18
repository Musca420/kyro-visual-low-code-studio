# Frontend Editor — Project Specification

## 1. Scopo del documento

Questo documento è il contratto di prodotto, architettura e completamento per **Frontend Editor**. L'agente di coding deve usarlo come source of truth, trasformare i requisiti in milestone verificabili e continuare il lavoro finché la Definition of Done dell'MVP non è soddisfatta.

Il prodotto non deve essere presentato come completo quando contiene soltanto mockup, schermate statiche, componenti scollegati o funzioni simulate. Ogni funzionalità dichiarata pronta deve essere verificabile nell'applicazione in esecuzione.

## 2. Visione

Frontend Editor è una piattaforma visuale low-code ispirata a:

- **Canva**, per la creazione grafica drag-and-drop;
- **Node-RED**, per flussi logici a nodi e un catalogo di estensioni installabili;
- **Home Assistant**, per configurazioni guidate e automazioni comprensibili;
- gli editor di codice moderni, per mantenere il risultato esportabile, leggibile e ampliabile.

L'utente deve poter costruire un'applicazione web responsive e prepararla per Android, definendo nello stesso ambiente sia l'interfaccia sia il comportamento. Il sistema deve generare una base realmente funzionante che possa essere successivamente revisionata e ampliata da uno sviluppatore o da un coding agent, senza perdere il controllo sull'aspetto grafico scelto dall'utente.

## 3. Principi di prodotto

1. **Visuale, ma non chiuso:** il codice generato deve essere esportabile e modificabile.
2. **Semplice, ma non finto:** le procedure guidate devono produrre configurazioni realmente funzionanti.
3. **Vertical slice prima della quantità:** un flusso completo vale più di molte feature incomplete.
4. **Source of truth strutturata:** il progetto visuale è rappresentato da un modello intermedio versionato, non dal codice generato.
5. **Estendibilità:** componenti, nodi, provider dati, template e generatori devono poter essere aggiunti tramite plugin.
6. **Sicurezza per impostazione predefinita:** segreti e credenziali non devono finire nel client o nel progetto esportato.
7. **Feedback immediato:** preview, validazione e diagnostica devono spiegare chiaramente errori e collegamenti mancanti.
8. **Accessibilità e responsive design:** non sono rifiniture finali, ma requisiti del sistema.

## 4. Utenti principali

- utenti non tecnici che vogliono creare un'interfaccia e collegarla a funzioni comuni;
- designer che vogliono trasformare una composizione grafica in un'app funzionante;
- sviluppatori che vogliono generare rapidamente una base mantenibile;
- team che desiderano template, componenti e flow riutilizzabili.

## 5. Esperienza principale

### 5.1 Gestione dei progetti

L'utente può:

- creare, nominare, duplicare, importare, esportare ed eliminare un progetto;
- partire da un progetto vuoto o da un template;
- salvare automaticamente le modifiche;
- chiudere e riaprire un progetto senza perdita di dati;
- visualizzare versione del formato, dipendenze, plugin e stato di validazione;
- usare undo/redo per le operazioni modificabili.

### 5.2 UI Builder

L'editor grafico deve includere:

- elenco e gestione delle pagine;
- canvas centrale con zoom e pan;
- drag-and-drop dalla palette;
- spostamento, ridimensionamento, duplicazione ed eliminazione;
- selezione singola e multipla;
- gerarchia dei componenti con riordinamento;
- griglia, guide, snapping, allineamento e distribuzione;
- pannello proprietà e pannello stili;
- breakpoint desktop, tablet e mobile;
- layout tramite Flexbox e CSS Grid;
- temi, token e variabili globali;
- stati default, hover, focus, active e disabled;
- transizioni, animazioni ed effetti configurabili;
- componenti riutilizzabili con proprietà esposte;
- undo/redo e scorciatoie da tastiera essenziali;
- preview responsiva e modalità interattiva.

Componenti MVP:

- container, stack, grid e spacer;
- testo, titolo, link, immagine e icona;
- pulsante;
- input, textarea, select, checkbox, radio e form;
- card, lista e tabella;
- navbar, tabs e modal;
- loader, stato vuoto, alert e toast.

Ogni componente deve avere un ID stabile, proprietà tipizzate, stili per breakpoint, eventi disponibili, binding dati e metadati di accessibilità.

### 5.3 Logic Flow Editor

Il comportamento viene costruito tramite nodi e collegamenti. Il flow editor deve supportare pan, zoom, selezione, collegamento, eliminazione, configurazione, validazione e debug.

Categorie di nodi MVP:

- **Eventi:** click, submit, change, page load e timer;
- **Controllo:** if/else, switch, loop controllato, delay e debounce;
- **Stato:** get state, set state e reset state;
- **Dati:** validate, map, filter, transform e format;
- **Navigazione:** apri pagina, torna indietro e apri URL;
- **UI:** mostra/nascondi, abilita/disabilita, aggiorna proprietà, apri/chiudi modal e mostra notifica;
- **Rete:** HTTP request e REST API;
- **Database:** query, get, insert, update, delete e subscribe quando supportato;
- **Autenticazione:** interfacce predisposte per login, logout, registrazione e sessione;
- **Debug:** log, inspect e gestione degli errori.

Il runtime dei flow deve:

- eseguire i nodi in modo deterministico;
- propagare valori tipizzati tra porte;
- supportare percorsi success/error;
- impedire loop incontrollati;
- gestire cancellazione, timeout e concorrenza;
- produrre log leggibili senza esporre segreti;
- evidenziare il nodo in esecuzione nella modalità debug;
- segnalare nodi incompleti, collegamenti incompatibili e riferimenti mancanti.

### 5.4 Data & Integrations

La configurazione dei dati deve essere guidata graficamente. Se un componente richiede dati ma non è collegato a una sorgente, l'editor deve proporre:

1. crea una nuova sorgente;
2. collega una sorgente esistente;
3. definisci o importa lo schema;
4. seleziona tabella o collezione;
5. configura query e mapping;
6. collega risultato, loading, empty state ed error state;
7. testa la connessione o l'operazione;
8. applica la configurazione al flow.

Per l'MVP deve esistere un provider locale realmente funzionante, preferibilmente IndexedDB per il web. L'architettura deve usare adapter per aggiungere in futuro SQLite, PostgreSQL, Supabase, Firebase, MySQL, MongoDB e altri servizi.

Ogni provider deve dichiarare capability, schema di configurazione, operazioni disponibili, requisiti server-side e strategia di gestione dei segreti. Se una funzione non può essere eseguita in sicurezza dal client, l'editor deve spiegarlo e generare o richiedere un backend appropriato.

### 5.5 Package e Plugin Manager

Come Node-RED, l'applicazione deve poter estendere le proprie capacità dall'interno. I plugin possono aggiungere:

- componenti visuali;
- nodi logici;
- provider dati;
- connettori API;
- template;
- temi;
- generatori di codice.

Per l'MVP è sufficiente un catalogo locale con installazione, abilitazione, disabilitazione e rimozione. Ogni plugin deve avere un manifest validabile contenente ID, nome, versione, autore, compatibilità, dipendenze, permessi, contributi e configurazione.

Il sistema deve impedire collisioni di ID, verificare compatibilità e dipendenze e non eseguire codice non attendibile senza una strategia di isolamento. Un marketplace remoto è fuori dall'MVP, ma l'architettura non deve impedirlo.

## 6. Modello intermedio del progetto

Definire un formato JSON versionato che rappresenti almeno:

- metadati e versione del progetto;
- pagine e routing;
- albero dei componenti;
- proprietà, stili e breakpoint;
- temi e token;
- animazioni;
- eventi e binding;
- flow, nodi, porte e collegamenti;
- stato dell'applicazione;
- sorgenti e schemi dati;
- asset;
- plugin e dipendenze;
- configurazioni di export.

Requisiti del formato:

- validazione tramite Zod o JSON Schema;
- migrazioni tra versioni;
- ID stabili e riferimenti verificati;
- serializzazione deterministica;
- import/export senza perdita;
- separazione tra dati del progetto e segreti;
- errori comprensibili e recupero sicuro da documenti non validi.

Il codice generato è un output derivato. Le modifiche manuali devono vivere in estensioni o aree protette dalla rigenerazione. Non implementare una falsa sincronizzazione bidirezionale tra codice arbitrario e modello visuale.

## 7. Preview e diagnostica

La preview deve essere isolata dall'editor e offrire:

- aggiornamento rapido dopo le modifiche;
- viewport desktop, tablet e mobile;
- modalità design e modalità interattiva;
- visualizzazione di errori di rendering e runtime;
- console dei flow;
- ispezione degli input/output dei nodi;
- loading, empty ed error state;
- riavvio o riesecuzione controllata di un flow.

La preview non deve poter accedere liberamente al contesto privilegiato dell'editor.

## 8. Generazione ed export

Il primo generatore deve produrre un'app web moderna, responsive, accessibile ed eseguibile separatamente. Deve includere componenti, routing, stato, flow, accesso ai dati e asset necessari.

L'output deve essere:

- TypeScript tipizzato;
- leggibile e formattato;
- modulare;
- privo di dipendenze inutili;
- installabile e avviabile con comandi documentati;
- testabile;
- senza credenziali incorporate.

Per Android, predisporre l'export web tramite Capacitor. Il vertical slice Android può consistere nella configurazione generabile e nelle istruzioni verificate; la build APK completa dipende dalla disponibilità dell'SDK Android nell'ambiente.

## 9. Stack tecnico preferito

Prima di scegliere lo stack, analizzare il repository e rispettare convenzioni e dipendenze già valide. Se il progetto è vuoto, usare come riferimento:

- React + TypeScript + Vite;
- React Flow per l'editor a nodi;
- dnd-kit per drag-and-drop;
- Zustand o Redux Toolkit per lo stato dell'editor;
- Zod o JSON Schema per modelli e manifest;
- IndexedDB tramite Dexie per il provider locale;
- CSS Modules, Tailwind CSS o un sistema coerente di design token;
- Vitest + Testing Library;
- Playwright per test end-to-end;
- ESLint + Prettier;
- Capacitor per Android.

Le librerie sono strumenti, non requisiti assoluti. Sostituzioni sono accettabili se motivate, mantenute e compatibili con gli obiettivi. Evitare dipendenze ridondanti o pacchetti non mantenuti.

## 10. Sicurezza

- non salvare segreti, token o password nel modello del progetto;
- non inserire segreti nel bundle client;
- validare input, manifest, documenti importati e configurazioni;
- isolare la preview;
- limitare le capability dei plugin;
- prevenire XSS nell'anteprima e nei contenuti dinamici;
- gestire URL, richieste esterne e CORS in modo esplicito;
- evitare `eval` e l'esecuzione arbitraria di codice;
- mascherare dati sensibili nei log;
- confermare operazioni distruttive.

## 11. Accessibilità e UX

- navigazione da tastiera per le funzioni principali;
- focus visibile;
- nomi accessibili per controlli e componenti;
- contrasto adeguato;
- HTML semantico nell'output;
- errori associati ai campi;
- feedback per salvataggio, installazione, export e test;
- stati vuoti con una prossima azione chiara;
- onboarding minimo per il primo progetto.

## 12. Vertical slice obbligatorio

Il primo scenario end-to-end deve permettere di:

1. creare un progetto;
2. creare una pagina;
3. trascinare input, pulsante e lista sul canvas;
4. modificarne posizione, dimensioni, stile e comportamento responsive;
5. creare graficamente una sorgente dati locale;
6. definire un record con almeno ID, testo e data;
7. collegare il click del pulsante a un flow;
8. leggere il valore dell'input;
9. validare che non sia vuoto;
10. inserire il record nel database;
11. aggiornare automaticamente la lista;
12. mostrare loading, stato vuoto ed errore;
13. eseguire il tutto nella preview;
14. salvare, chiudere e riaprire il progetto;
15. esportare il codice;
16. installare e avviare separatamente l'app esportata;
17. superare un test end-to-end del percorso principale.

Finché questo scenario non funziona realmente dall'inizio alla fine, l'MVP non è completato.

## 13. Milestone consigliate

1. Analisi repository, architettura e piano verificabile.
2. Modello progetto versionato, validazione e migrazioni.
3. Shell dell'editor e gestione progetti/pagine.
4. Canvas, palette, gerarchia e proprietà.
5. Stili, breakpoint, temi e undo/redo.
6. Flow editor e validazione dei collegamenti.
7. Runtime dei flow con debug ed error handling.
8. Provider IndexedDB e data binding.
9. Vertical slice completo nella preview.
10. Persistenza, import ed export del progetto.
11. Generatore web ed esecuzione separata.
12. Test automatici, accessibilità e responsive QA.
13. Plugin manager locale.
14. Configurazione Capacitor e documentazione Android.
15. Review finale e correzione delle regressioni.

Ogni milestone deve lasciare il repository in uno stato avviabile e verificato.

## 14. Modalità di lavoro dell'agente

Prima di modificare file:

- leggere README, AGENTS.md e configurazioni applicabili;
- analizzare tutto il repository;
- controllare lo stato Git e preservare le modifiche dell'utente;
- identificare ciò che è già implementato;
- trasformare questa specifica in un piano con criteri di accettazione.

Per ogni ciclo:

1. scegliere il requisito incompleto a maggior valore o rischio;
2. implementare un incremento verticale;
3. eseguire typecheck, lint e test pertinenti;
4. avviare l'app e verificare il comportamento;
5. correggere errori e regressioni;
6. controllare responsive design e accessibilità;
7. aggiornare test, piano e documentazione;
8. registrare prove verificabili;
9. continuare con il requisito successivo.

Non fermarsi dopo scaffolding, piano, mockup o singola schermata. Non dichiarare completata una funzione non provata. Fare assunzioni ragionevoli quando reversibili; chiedere l'intervento dell'utente soltanto per credenziali, costi, pubblicazione, autorizzazioni, azioni distruttive o decisioni architetturali sostanziali.

## 15. Definition of Done dell'MVP

Il goal può essere dichiarato completato soltanto quando:

- installazione e avvio sono riproducibili e documentati;
- typecheck e lint non hanno errori bloccanti;
- i test unitari/integrativi principali passano;
- almeno un test Playwright copre il vertical slice;
- progetto, pagina e componenti possono essere creati e riaperti;
- canvas e pannelli permettono modifiche reali;
- responsive design e stili vengono applicati alla preview e all'export;
- gli eventi dei componenti possono essere collegati ai flow;
- il runtime esegue il flow con percorsi success/error;
- il provider locale salva e recupera dati reali;
- il vertical slice obbligatorio funziona;
- la preview è interattiva e mostra diagnostica utile;
- il progetto visuale può essere importato/esportato;
- l'app generata può essere installata e avviata indipendentemente;
- il plugin manager locale esegue almeno installazione, enable, disable e remove di un plugin di esempio;
- la base Capacitor è generabile o la limitazione ambientale è documentata con precisione;
- il README descrive architettura, comandi, modello dati, sicurezza, limiti e prossimi passi;
- placeholder, mock e funzionalità future sono esplicitamente identificati.

## 16. Review finale obbligatoria

Al termine, eseguire una review come se il codice fosse stato scritto da un altro team. Controllare:

- correttezza funzionale;
- sicurezza e gestione dei segreti;
- consistenza dello stato e del modello dati;
- prestazioni del canvas e dei flow;
- error handling;
- accessibilità;
- responsive design;
- qualità e riproducibilità dell'export;
- dipendenze inutili o vulnerabili;
- copertura e affidabilità dei test;
- documentazione e dichiarazioni di completezza.

Correggere direttamente tutti i problemi risolvibili nello scope. Il report finale deve indicare cosa è stato realizzato, architettura, comandi, test eseguiti con risultati, prova del vertical slice, limitazioni, rischi e prossime priorità.

