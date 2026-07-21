# KYRO EVOLUTION CONTRACT

Version: 2.0

Status: ACTIVE

Authoritative Document

---

# Purpose

Questo documento rappresenta il contratto di evoluzione di Kyro.

Non è una roadmap.

Non è una documentazione tecnica.

Non è una specifica.

È il documento che descrive:

- cosa Kyro è;
- cosa Kyro non deve diventare;
- come deve evolvere;
- come capire se un lavoro è realmente completato.

Ogni modifica al codice deve essere coerente con questo documento.

---

# How to Use

L'agente deve leggere questo documento ad ogni ciclo.

L'agente NON modifica questo documento.

L'agente aggiorna solamente

docs/20-KYRO_CHECKLIST.md

Questo documento cambia soltanto quando l'architettura del prodotto viene modificata intenzionalmente.

---

# Vision

Kyro è una piattaforma visuale graph-native.

Lo scopo di Kyro non è generare codice.

Lo scopo di Kyro è permettere la costruzione di vere applicazioni.

Il codice rappresenta solamente uno degli artefatti prodotti.

Il prodotto è il Graph.

---

# Product Identity

Kyro è

- Visual First

- Graph Native

- AI Assisted

- Deterministic

- Verifiable

- Local First

---

Kyro NON è

- un IDE

- un Prompt Builder

- un Code Generator

- un Chatbot

- un Framework AI

---

# Product Promise

Un utente che sa costruire una buona interfaccia grafica deve poter costruire una vera applicazione Web o Web App senza conoscere la programmazione.

L'AI rappresenta solamente un acceleratore.

Mai un requisito.

---

# Non Goals

Kyro NON deve

- rendere Codex obbligatorio

- creare un secondo modello applicativo

- usare il codice come sorgente di verità

- utilizzare routing lessicale come motore decisionale

- rompere la compatibilità dei progetti

- introdurre scorciatoie che riducono verificabilità

- trasformarsi in un IDE

---

# Architectural Identity

Esiste un solo modello applicativo.

Il Graph.

Esiste un solo prodotto.

Ogni altro sistema rappresenta solamente una vista differente dello stesso modello.

Editor

↓

Runtime

↓

Preview

↓

Export

↓

Codice

sono rappresentazioni derivate.

Mai sorgenti di verità.

---

# Golden Rules

Queste regole non possono essere violate.

## G-01

Il Graph è sempre la sorgente di verità.

---

## G-02

Il Runtime non modifica il Graph.

---

## G-03

Preview utilizza lo stesso Runtime.

---

## G-04

Export deriva sempre dal Graph.

---

## G-05

Ogni modifica appartiene ad un Job.

---

## G-06

Ogni modifica appartiene ad una Transaction.

---

## G-07

Ogni modifica produce evidenze.

---

## G-08

Ogni modifica viene verificata.

---

## G-09

Codex è opzionale.

---

## G-10

L'editor rimane completamente utilizzabile senza AI.

---

## G-11

Capability rappresenta un contratto.

Modulo rappresenta un'implementazione.

---

## G-12

Manuale e Codex producono sempre lo stesso progetto.

---

## G-13

Mai AI Leakage.

Il progetto finale non contiene tracce del fatto che sia stato costruito con AI.

---

## G-14

Mai esistono due modelli applicativi differenti.

---

## G-15

Ogni nuova funzionalità nasce già verificabile.

Mai:

Implementazione

↓

Test

Sempre:

Implementazione

+

Verifica

insieme.

---

# Current Product

La release attuale possiede già solide fondamenta.

Sono considerate stabili e devono essere preservate.

- Editor

- Graph

- Preview

- Runtime

- Undo

- Transaction

- Web

- PWA

- Codex Integration

- MCP

- Capability

- Open Mode

L'obiettivo NON è riscrivere questi elementi.

L'obiettivo è renderli più robusti.

---

# Evolution Strategy

Ogni modifica deve essere

- incrementale

- compatibile

- reversibile

- verificabile

Mai introdurre una riscrittura completa del sistema.

Mai sostituire un sottosistema stabile senza una motivazione dimostrabile.

---

# Architectural Direction

Il Core deve diventare solamente l'autorità del sistema.

Il Core governa.

Codex ragiona.

Il Runtime esegue.

L'Editor costruisce.

L'Export produce artefatti.

Ogni sottosistema possiede responsabilità chiaramente separate.

---

# Evolution Areas

L'evoluzione del progetto avviene in ordine.

## P0

Core

Agent

Transaction

Runtime

Security

Verification

MCP

---

## P1

Capability

Open Mode

Consistency

UX

Artifact Registry

---

## P2

Demo

Release

Ottimizzazione

Mai iniziare un punto P1 se esistono punti P0 incompleti.

Mai iniziare un punto P2 se esistono punti P1 incompleti.

---

# Definition of Success

Kyro 2.0 sarà completato quando

- un utente costruirà una Web App completamente manualmente;

- un secondo utente utilizzerà Codex solo come acceleratore;

- entrambe le applicazioni saranno indistinguibili;

- Runtime, Preview ed Export produrranno lo stesso risultato;

- tutte le modifiche saranno verificabili;

- tutte le modifiche saranno annullabili;

- tutte le modifiche saranno riproducibili;

- una giuria tecnica potrà comprendere il funzionamento del sistema senza conoscere il codice.

---

# Final Rule

L'obiettivo dell'agente NON è produrre codice.

L'obiettivo dell'agente è rendere Kyro progressivamente più coerente con questo contratto.

Ogni implementazione deve migliorare almeno una delle seguenti proprietà:

- Coerenza

- Compatibilità

- Verificabilità

- Sicurezza

- Semplicità

- Robustezza

Se una modifica migliora il codice ma peggiora una di queste proprietà, la modifica NON deve essere applicata.