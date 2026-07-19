Usa Kyro per creare due progetti complessi che implementano la stessa piattaforma:



1\. “NexusField Mobile”: applicazione Android;

2\. “NexusField Web”: applicazione web responsive/PWA.



\## Obiettivo



Questi progetti servono a validare Kyro su un insieme molto ampio di casi d’uso. Se un utente riesce a realizzarli completamente attraverso l’interfaccia visuale, Kyro deve essere sufficientemente flessibile per creare molte altre categorie di siti e applicazioni.



La validazione deve riguardare non soltanto il codice generato, ma l’intero processo visuale: creazione, configurazione, collegamento dei dati, preview, interazioni, export ed esecuzione finale.



\## Vincolo sul server privato



Non accedere, modificare, riavviare, interrogare o distribuire nulla sul mio server privato.



Usa esclusivamente:



\- ambiente locale;

\- database locale;

\- mock server;

\- servizi sandbox esplicitamente autorizzati;

\- emulatori e browser locali.



Non riutilizzare credenziali, configurazioni o indirizzi del server privato.



\## NexusField



NexusField permette di trovare, prenotare e gestire professionisti come tecnici, insegnanti e manutentori.



Deve supportare clienti, professionisti, dipendenti, responsabili e amministratori, includendo:



\- autenticazione, profili, organizzazioni, ruoli e permessi;

\- ricerca, filtri, mappe e preferiti;

\- servizi, disponibilità, preventivi e prenotazioni;

\- calendario;

\- pagamenti sandbox, coupon e rimborsi;

\- chat realtime e notifiche;

\- caricamento di immagini e documenti;

\- firma digitale;

\- fatture PDF;

\- inventario;

\- assegnazione degli interventi;

\- gestione del team;

\- statistiche;

\- recensioni;

\- contestazioni;

\- audit log;

\- modalità offline e sincronizzazione.



\### NexusField Mobile



Deve includere:



\- navigazione mobile;

\- gesture;

\- safe area;

\- fotocamera;

\- geolocalizzazione;

\- mappe;

\- notifiche push e locali;

\- deep link;

\- QR e barcode;

\- firma touchscreen;

\- modalità offline;

\- supporto smartphone e tablet;

\- build Android installabile.



\### NexusField Web



Deve includere:



\- layout desktop, tablet e mobile;

\- PWA installabile;

\- sidebar e navbar responsive;

\- pannello amministrativo;

\- tabelle avanzate;

\- filtri e paginazione;

\- accessibilità da tastiera;

\- routing condivisibile;

\- SEO per le pagine pubbliche;

\- modalità offline;

\- export per self-hosting locale.



I progetti devono essere separati, portabili ed eseguibili indipendentemente, ma possono condividere un backend locale e lo stesso database.



\## Creazione attraverso Kyro



Costruisci entrambi esclusivamente tramite l’interfaccia visuale di Kyro:



\- canvas;

\- drag-and-drop;

\- componenti;

\- proprietà visuali;

\- nodi e flow;

\- database visuale;

\- binding;

\- Live Bridge;

\- “Chiedi a Codex”;

\- preview;

\- export.



Comportati come un utente reale. Non modificare direttamente JSON, database, stato interno o codice generato per aggirare l’interfaccia.



Se Kyro non permette di completare un passaggio:



1\. considera la mancanza un difetto di Kyro;

2\. individua la causa generale;

3\. correggi Kyro;

4\. aggiungi componenti, nodi o integrazioni necessari;

5\. torna nell’interfaccia;

6\. ripeti il passaggio visualmente;

7\. verifica nuovamente il risultato.



\## Correzioni globali e riutilizzabili



Tutte le correzioni effettuate durante la creazione di NexusField Mobile e NexusField Web devono migliorare Kyro a livello globale.



Non creare soluzioni cucite specificamente su NexusField e non introdurre:



\- nomi di progetto hardcoded;

\- schemi dati dedicati;

\- componenti utilizzabili soltanto da NexusField;

\- flow o eccezioni speciali;

\- comportamenti attivati dai dati dei test;

\- scorciatoie create soltanto per superare Playwright.



Ogni soluzione deve diventare una funzionalità generica e configurabile di Kyro, per esempio:



\- componente riutilizzabile;

\- nodo generico;

\- provider o adapter;

\- regola di validazione;

\- miglioramento del runtime;

\- estensione del modello intermedio;

\- procedura guidata;

\- plugin;

\- miglioramento del generatore o della UI.



Per ogni problema:



1\. identifica la causa generale;

2\. determina quali altre categorie di applicazioni potrebbero incontrarlo;

3\. implementa una soluzione indipendente da NexusField;

4\. aggiungi test generali di Kyro;

5\. verifica anche un caso con nomi, dati o componenti differenti;

6\. controlla che non introduca regressioni;

7\. ripeti tramite Playwright il flusso NexusField che aveva rilevato il problema.



Una correzione è valida soltanto se può essere riutilizzata anche per progetti diversi, come e-commerce, gestionali, social network, dashboard, portfolio e altre applicazioni web o Android.



\## Test UI obbligatori con Playwright



Usa Playwright in modalità headed, con la finestra del browser visibile, durante tutta la validazione.



Playwright non deve essere utilizzato soltanto alla fine: deve accompagnare la costruzione e la verifica dei progetti.



Attraverso la finestra reale di Playwright devi:



\- aprire Kyro;

\- creare e riaprire i progetti;

\- selezionare componenti;

\- utilizzare menu e pannelli;

\- eseguire drag-and-drop;

\- collegare nodi;

\- compilare form;

\- aprire la preview;

\- interagire con le applicazioni;

\- verificare salvataggio ed export.



Simula un utente con:



\- movimenti visibili del cursore;

\- click reali;

\- digitazione progressiva;

\- pause tra le azioni;

\- scrolling naturale;

\- viewport desktop, tablet e mobile.



Usa selettori basati su ruolo, label e testo accessibile. Evita coordinate rigide, salvo quando servono realmente per testare canvas e drag-and-drop.



\## Verifiche visuali e funzionali



Con Playwright controlla:



\- elementi mancanti o sovrapposti;

\- click non ricevuti;

\- pulsanti coperti;

\- menu che si aprono fuori dallo schermo;

\- errori responsive;

\- overflow;

\- testo tagliato;

\- focus e navigazione da tastiera;

\- modali e overlay;

\- loading, empty ed error state;

\- animazioni;

\- rendering lento;

\- errori JavaScript;

\- richieste di rete fallite;

\- errori nella console;

\- persistenza dopo refresh e riapertura.



Cattura screenshot alle risoluzioni principali e usa confronti visuali per individuare regressioni.



Se un test Playwright fallisce:



1\. conserva screenshot, trace, video e log;

2\. riproduci il problema nella finestra visibile;

3\. individua la causa generale;

4\. correggi Kyro con una soluzione globale e riutilizzabile;

5\. correggi il progetto soltanto se contiene una configurazione realmente errata;

6\. ripeti il flusso dalla UI;

7\. continua solo dopo il superamento del test.



\## Flussi end-to-end



Verifica su Mobile e Web almeno:



1\. registrazione e login;

2\. ricerca → preventivo → prenotazione → pagamento sandbox;

3\. accettazione e assegnazione di un intervento;

4\. chat e notifiche realtime;

5\. completamento → firma → fattura → recensione;

6\. contestazione → amministratore → rimborso;

7\. accesso negato a dati non autorizzati;

8\. utilizzo offline e successiva sincronizzazione;

9\. salvataggio, chiusura e riapertura;

10\. export e avvio indipendente.



Crea una matrice Mobile/Web che mostri la parità funzionale e le eventuali differenze specifiche della piattaforma.



\## Verifica Android



Testa il progetto Mobile inizialmente nella preview mobile di Kyro attraverso Playwright.



Successivamente:



\- genera la struttura Android;

\- compila la build;

\- installala su emulatore o dispositivo;

\- verifica avvio, navigazione, back button, tastiera, permessi, offline e persistenza;

\- registra screenshot e video dell’emulatore.



Non dichiarare verificata la build Android se è stata provata soltanto nella preview del browser.



\## Video dimostrativo



La registrazione deve essere realizzata con Playwright durante l’interazione reale con Kyro, non ricostruita artificialmente dopo.



Prepara quattro sequenze:



1\. creazione di una funzione Web manualmente con canvas e nodi;

2\. creazione della stessa funzione Web con Codex;

3\. creazione di una funzione Mobile manualmente;

4\. creazione della stessa funzione Mobile con Codex.



Registra anche il risultato finale:



\- NexusField Web in esecuzione;

\- NexusField Mobile nella preview;

\- NexusField Mobile installata sull’emulatore;

\- dati realmente condivisi.



Configura Playwright per:



\- modalità headed;

\- registrazione video attiva;

\- risoluzione preferibilmente 1920×1080;

\- `slowMo` o ritardi equivalenti;

\- pause di 1–2 secondi nei passaggi importanti;

\- movimenti del cursore comprensibili;

\- digitazione leggibile;

\- conservazione di video, trace e screenshot.



Aggiungi nel montaggio:



\- logo Kyro;

\- indicatore dei click;

\- titoli “Creazione manuale” e “Creazione con Codex”;

\- brevi didascalie;

\- zoom sui pannelli importanti;

\- conclusione con Web e Android funzionanti.



Usa FFmpeg per convertire e unire i filmati in MP4. Non mostrare credenziali, token o informazioni sensibili.



\## Definition of Done



Non considerare il lavoro completo finché:



\- entrambi i progetti sono stati creati tramite la UI di Kyro;

\- Playwright ha verificato live la creazione e l’utilizzo;

\- screenshot, trace, console e video non mostrano errori bloccanti;

\- Android e Web eseguono correttamente gli stessi flussi;

\- backend e dati locali sono realmente collegati;

\- responsive design, click e rendering sono verificati;

\- la build Android è installata e testata;

\- Web export e PWA si avviano indipendentemente;

\- i test end-to-end passano;

\- nessuna operazione ha coinvolto il server privato;

\- ogni limite trovato ha prodotto un miglioramento globale, configurabile e riutilizzabile di Kyro;

\- nessuna correzione contiene riferimenti, eccezioni o comportamenti hardcoded per NexusField;

\- ogni correzione generale è coperta da test di Kyro e da almeno un caso diverso da NexusField;

\- il video dimostrativo MP4 è completo e pronto per l’hackathon.



Al termine consegna:



\- build Android;

\- export Web;

\- matrice Mobile/Web;

\- risultati Playwright;

\- screenshot;

\- trace;

\- video originali;

\- MP4 finale;

\- bug trovati e correzioni globali applicate a Kyro.

