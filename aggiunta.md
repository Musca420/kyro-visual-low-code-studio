Aggiungi questo requisito fondamentale alla Definition of Done complessiva del progetto.

## Obiettivo finale: sviluppo accessibile a utenti non tecnici

Non considerare Frontend Editor completato finché una persona con conoscenze di programmazione basse o quasi nulle non può creare, esclusivamente tramite l’interfaccia grafica e l’assistenza di Codex:

1. una pagina web moderna, ricca e realmente funzionante;
2. un’applicazione web completa;
3. un progetto Android correttamente strutturato, compilabile ed eseguibile.

L’utente non deve essere obbligato a:

- modificare codice;
- conoscere HTML, CSS o JavaScript;
- scrivere query;
- modificare JSON;
- usare il terminale;
- configurare manualmente cartelle e file;
- conoscere nomi di librerie;
- comprendere concetti tecnici non necessari.

Il terminale e il codice devono rimanere disponibili per utenti avanzati, ma non devono essere indispensabili per completare i flussi principali.

## Due modalità complementari

Ogni attività deve poter essere svolta in due modi.

### 1. Modalità manuale visuale

L’utente deve poter costruire e modificare direttamente il progetto usando canvas, drag-and-drop, pannelli, controlli visuali e procedure guidate.

### 2. Modalità assistita da Codex

L’utente deve poter selezionare una pagina, un componente, un flow o una sorgente dati e spiegare in linguaggio naturale il risultato desiderato.

Esempi:

- “Rendi questa card più moderna.”
- “Sposta il pulsante sotto il form.”
- “Su mobile metti questi elementi uno sotto l’altro.”
- “Aggiungi un effetto quando passo sopra l’immagine.”
- “Quando clicco qui, salva un nuovo atleta.”
- “Crea una pagina di login.”
- “Collega questa lista a un database.”
- “Crea anche il backend necessario.”
- “Trasforma questo progetto in un’app Android.”

Codex deve osservare il progetto tramite la skill `frontend-editor-live`, comprendere la selezione, proporre ciò che manca, applicare modifiche strutturate, verificare la preview e permettere undo.

## Controllo visuale completo

Aggiungi tutti i controlli necessari affinché l’utente possa configurare senza CSS manuale:

- larghezza e altezza;
- dimensioni minime e massime;
- margini e padding;
- allineamento;
- posizione;
- ordine e sovrapposizione;
- Flexbox e Grid tramite controlli comprensibili;
- gap;
- comportamento responsive;
- visibilità per breakpoint;
- colori e opacità;
- tipografia;
- font locali o web;
- dimensione, peso e altezza di linea;
- bordi;
- spessore e stile dei bordi;
- border radius per ogni angolo;
- ombre;
- sfondi;
- gradienti;
- immagini e overlay;
- icone;
- filtri;
- blur;
- trasformazioni;
- rotazione e scala;
- transizioni;
- animazioni;
- keyframe o preset visuali;
- hover, focus, active e disabled;
- posizione sticky e fixed;
- overflow;
- aspect ratio;
- cursore;
- tooltip;
- componenti accessibili.

Quando possibile, mostra controlli visuali, maniglie sul canvas e valori comprensibili. Mantieni disponibile una modalità avanzata per inserire valori precisi.

Ogni modifica deve essere visibile immediatamente nella preview e supportare undo/redo.

## Libreria moderna di componenti

L’utente deve avere componenti pronti per realizzare siti e applicazioni moderne:

- header e navbar;
- sidebar;
- hero;
- footer;
- sezioni;
- card;
- griglie;
- carousel;
- gallery;
- menu responsive;
- breadcrumb;
- tabs;
- accordion;
- modal e drawer;
- tooltip;
- form;
- input e selettori;
- ricerca;
- filtri;
- tabelle;
- liste;
- paginazione;
- upload;
- avatar;
- badge;
- progress;
- skeleton;
- loader;
- empty state;
- toast;
- alert;
- grafici;
- calendario;
- mappe, quando configurate;
- audio e video;
- componenti riutilizzabili.

Aggiungi template completi e modificabili, per esempio:

- landing page;
- portfolio;
- sito aziendale;
- blog;
- e-commerce;
- dashboard;
- autenticazione;
- gestionale;
- applicazione mobile.

Non inserire soltanto esempi statici: i componenti devono poter essere collegati a dati e flow reali.

## Funzionalità applicative reali

Tramite procedure guidate e Codex, l’utente deve poter configurare:

- navigazione e routing;
- stato locale e globale;
- database;
- CRUD;
- API REST;
- autenticazione;
- ruoli e autorizzazioni;
- form e validazione;
- ricerca, filtro e ordinamento;
- caricamento file;
- gestione asset;
- storage;
- notifiche;
- WebSocket o aggiornamenti in tempo reale;
- variabili d’ambiente;
- loading, empty ed error state;
- gestione offline quando prevista;
- backend necessario alle operazioni non sicure nel client.

Se manca un requisito, Frontend Editor deve rilevarlo e proporre una soluzione comprensibile.

Esempio:

“Questa funzione richiede il salvataggio dei dati, ma il progetto non ha ancora una sorgente dati. Vuoi usare un database locale, collegare un servizio esistente oppure generare un backend?”

Non mostrare scelte tecniche senza spiegarne l’effetto pratico.

## Esperienza Codex per utenti non tecnici

Le risposte di Codex dentro l’editor devono usare un linguaggio semplice.

Invece di mostrare soltanto un diff tecnico, mostra:

- cosa cambierà;
- quali elementi saranno interessati;
- perché serve;
- eventuali dati o servizi da creare;
- possibili costi o requisiti esterni;
- anteprima del risultato;
- pulsanti Conferma, Modifica richiesta e Annulla.

Dopo la modifica mostra:

- risultato visuale;
- operazioni effettuate;
- test eseguiti;
- eventuali problemi;
- pulsante Ripristina;
- possibilità di chiedere ulteriori modifiche.

Codex deve porre domande brevi e guidate quando manca una decisione, preferibilmente offrendo poche opzioni comprensibili.

## Creazione di applicazioni Android

Quando l’utente seleziona “Applicazione Android”, Frontend Editor deve creare automaticamente la struttura corretta del progetto.

In base all’architettura esistente, usa Capacitor o un’altra soluzione attuale, stabile e motivata.

Il sistema deve gestire graficamente:

- creazione della cartella Android;
- configurazione del package ID;
- nome dell’app;
- icona;
- splash screen;
- orientamento;
- tema e status bar;
- versioni;
- permessi;
- navigazione;
- responsive layout;
- safe area;
- tastiera;
- back button;
- storage locale;
- configurazione di rete;
- build di sviluppo;
- validazione del progetto;
- istruzioni per firma e pubblicazione.

L’utente deve lavorare principalmente sul canvas. Struttura, configurazioni e file Android devono essere generati automaticamente.

Se Android SDK, Java, Gradle o altri strumenti non sono presenti, Frontend Editor deve rilevarlo e mostrare una procedura guidata. Non dichiarare verificata una build che non è stata realmente eseguita.

Quando l’ambiente lo permette, produci e installa una build di test su emulatore o dispositivo. Verifica navigazione, layout, tastiera, rotazione, back button e persistenza.

## Tecnologie moderne

Esegui un audit dell’architettura e delle dipendenze usando documentazione ufficiale aggiornata.

Adotta tecniche moderne quando portano vantaggi concreti:

- TypeScript rigoroso;
- design token;
- componenti riutilizzabili;
- responsive design moderno;
- container query quando appropriate;
- semantic HTML;
- accessibilità WCAG 2.2 AA;
- lazy loading;
- code splitting;
- ottimizzazione degli asset;
- PWA quando richiesta;
- gestione sicura dei segreti;
- dipendenze mantenute;
- test automatici;
- monitoraggio degli errori;
- buone prestazioni e Core Web Vitals.

Non aggiornare o aggiungere librerie soltanto perché sono nuove. Verifica stabilità, manutenzione, compatibilità, sicurezza e reale utilità.

## Onboarding e semplicità

Crea un onboarding guidato che permetta a un nuovo utente di:

1. scegliere Web, PWA o Android;
2. selezionare un template;
3. scegliere tema e colori;
4. creare la prima pagina;
5. aggiungere componenti;
6. provare la preview;
7. aggiungere una prima interazione;
8. chiedere una modifica a Codex;
9. salvare;
10. esportare ed eseguire il progetto.

Aggiungi:

- tooltip contestuali;
- esempi;
- stati vuoti utili;
- ricerca dei componenti;
- comandi rapidi;
- command palette;
- cronologia;
- messaggi d’errore comprensibili;
- valori predefiniti sensati;
- conferme solo quando realmente necessarie.

## Test di usabilità obbligatorio

Verifica il prodotto utilizzando il browser come un utente non tecnico.

Non preparare direttamente i risultati tramite codice o manipolazione dei dati interni.

Completa almeno questi test esclusivamente dall’interfaccia:

### Test A: sito web ricco

Creare un sito responsive con:

- più pagine;
- navbar mobile;
- hero;
- sezioni animate;
- form funzionante;
- dati reali;
- immagini;
- modal;
- ricerca o filtro;
- footer;
- responsive design;
- preview;
- export;
- avvio separato.

### Test B: applicazione gestionale

Creare un’app con:

- login o flusso di autenticazione configurabile;
- dashboard;
- CRUD;
- database;
- ricerca;
- filtri;
- validazione;
- loading;
- error handling;
- navigazione;
- test.

### Test C: Android

Creare dall’interfaccia un progetto Android, generare la struttura, configurare dati e funzioni, produrre la build quando l’ambiente lo consente e verificare il comportamento su emulatore o dispositivo.

Per ciascun test registra:

- numero e tipo di passaggi;
- punti confusi;
- errori;
- interventi manuali sul codice;
- richieste fatte a Codex;
- risultato finale.

Se un passaggio richiede codice senza essere esplicitamente una funzione avanzata, consideralo un problema UX da correggere.

## Definition of Done aggiuntiva

Non considerare completato il progetto finché:

- un utente non tecnico può costruire una pagina ricca senza scrivere codice;
- layout, dimensioni, bordi, angoli, effetti e animazioni sono modificabili visualmente;
- le stesse modifiche possono essere richieste a Codex;
- Codex vede componente, canvas, nodi e preview tramite la skill live;
- flow e sorgenti dati possono essere creati graficamente;
- database e backend mancanti vengono rilevati e proposti;
- il risultato funziona realmente fuori dall’editor;
- il codice esportato è installabile e avviabile;
- un progetto Android viene strutturato correttamente;
- i flussi principali sono accessibili e responsive;
- undo/redo e ripristino delle operazioni Codex funzionano;
- i tre test di usabilità sono stati completati;
- non rimangono bug bloccanti nei percorsi principali;
- documentazione e onboarding sono sufficienti per iniziare senza assistenza tecnica.

Non fermarti a una UI esteticamente gradevole ma non funzionante, né a funzioni potenti che richiedono conoscenze tecniche elevate.

Continua attraverso cicli di osservazione, implementazione, test nel browser, correzione e semplificazione finché questi criteri sono dimostrati con risultati riproducibili.

Se un requisito è bloccato da credenziali, costi, strumenti esterni o hardware non disponibile, completa tutto ciò che è possibile, documenta esattamente il blocco e non descrivere la parte non verificata come funzionante.