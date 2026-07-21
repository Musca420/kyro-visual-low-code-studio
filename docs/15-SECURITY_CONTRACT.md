# SECURITY CONTRACT

Version: 2.0

Status: ACTIVE

Authoritative Document

---

# Purpose

Questo documento definisce le proprietà di sicurezza di Kyro.

La sicurezza NON rappresenta una funzionalità.

La sicurezza rappresenta una proprietà fondamentale del sistema.

Ogni nuova implementazione deve rispettare questo documento.

Se una nuova funzionalità entra in conflitto con questo contratto, la funzionalità deve essere modificata.

Mai il contrario.

---

# Security Philosophy

Kyro è progettato secondo il principio

**Secure by Construction**

La sicurezza viene progettata insieme alle funzionalità.

Mai aggiunta successivamente.

Ogni nuovo componente nasce già:

- verificabile
- autorizzabile
- auditabile
- isolabile

---

# Security Objectives

Kyro deve proteggere

- il Project Graph
- i progetti dell'utente
- il Runtime
- l'Editor
- il sistema host
- i segreti
- gli artefatti
- la cronologia
- le transazioni

La perdita di una di queste proprietà rappresenta una regressione.

---

# Security Layers

La sicurezza viene applicata su tre livelli.

## Product Safety

Protegge

- Graph
- Transaction
- Revision
- Undo
- Capability

---

## Runtime Safety

Protegge

- Runtime

- Preview

- Export

- Processi

- Memoria

- Filesystem

---

## AI Safety

Protegge

- Codex

- MCP

- Prompt

- Tool

- Secrets

- Shell

---

# Golden Rules

## S-01

Il Graph è sempre protetto.

Mai modifiche fuori Transaction Engine.

---

## S-02

Ogni mutazione è autorizzata.

---

## S-03

Ogni mutazione è verificata.

---

## S-04

Ogni mutazione è auditata.

---

## S-05

Ogni mutazione produce evidenze.

---

## S-06

Il Runtime non possiede stato persistente.

---

## S-07

Preview ed Export utilizzano solamente dati verificati.

---

## S-08

Il Core rappresenta sempre l'autorità finale.

Mai Codex.

---

# Shell Policy

L'agente NON dispone di una shell libera.

La shell deve essere sempre confinata.

Consentito

- node

- npm run

- pnpm run

- tsc

- vitest

- playwright

- git status

- git diff

Consentito con approvazione

- installazione dependency

- aggiornamento package

- lockfile

Vietato

- sudo

- rm -rf

- chmod fuori workspace

- powershell arbitraria

- curl | bash

- wget | bash

- modifica configurazione host

---

# Filesystem Policy

L'agente lavora esclusivamente nel workspace del progetto.

Mai

- Home utente

- Desktop

- Documenti

- SSH

- Configurazioni IDE

- Cartelle di sistema

Ogni path deve essere normalizzato.

Path Traversal deve essere rifiutato.

Symlink Escape deve essere rifiutato.

---

# Network Policy

Per impostazione predefinita

nessuna connessione esterna.

Le connessioni sono consentite esclusivamente verso host autorizzati.

Mai upload di

- codice

- segreti

- token

- credenziali

- dati utente

senza autorizzazione.

---

# Secret Policy

Mai inviare al modello

- API Key

- Password

- Token

- Cookie

- SSH

- Variabili Environment

Prima di ogni richiesta

deve essere eseguita

Secret Redaction.

---

# Dependency Policy

Ogni nuova dependency deve dichiarare

- motivo

- versione

- licenza

- rischio

- rollback

- piattaforme coinvolte

Mai installazione automatica.

---

# Capability Security

Ogni Capability deve dichiarare

- input

- output

- effetti

- permessi

- dipendenze

- piattaforme

- versione

Mai Capability prive di contratto.

---

# Runtime Security

Ogni Runtime deve essere confinato.

Il Runtime NON può

- modificare il Graph

- creare Revision

- modificare Capability

- modificare Authorization

- modificare Transaction

---

# MCP Security

Ogni Tool dichiara

- Read

- Write

- Verify

- Build

- Filesystem

- Network

- Shell

- Side Effects

Mai Tool con effetti impliciti.

---

# Audit

Ogni operazione importante produce

- timestamp

- Job

- Transaction

- Tool

- risultato

- evidenze

L'audit non deve essere modificabile.

---

# Trust Levels

Ogni elemento possiede un livello di fiducia.

Core

★★★★★

Graph

★★★★★

Capability verificata

★★★★★

Modulo interno

★★★★☆

Runtime Adapter

★★★★☆

Generated Module

★★★☆☆

Plugin esterno

★★☆☆☆

Generated Code

★★☆☆☆

Nuova Dependency

★☆☆☆☆

Il livello di fiducia determina

il livello di verifica richiesto.

---

# Security Budget

Ogni Job possiede limiti.

Massimo

- Shell Commands

- File modificati

- Dependency

- Processi

- Build

- Runtime Adapter

- Network Requests

Superato il budget

↓

SECURITY REVIEW REQUIRED

---

# Security Tests

Ogni release deve verificare

- Shell Escape

- Filesystem Escape

- Path Traversal

- Symlink Escape

- Retry

- Race Condition

- Authorization

- Secret Leakage

- Dependency Policy

- Rollback

- Replay

---

# Definition of Done

Una funzionalità soddisfa il Security Contract quando

- implementazione completata

- sicurezza rispettata

- test sicurezza completati

- nessuna regressione

- evidenze prodotte

Mai considerare sufficienti

solamente

gli Unit Test.

---

# Final Rule

La sicurezza non è negoziabile.

Quando una funzionalità entra in conflitto con questo contratto

deve essere modificata la funzionalità.

Mai il contratto.