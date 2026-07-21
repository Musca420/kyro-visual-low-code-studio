# LOOP PROMPT

Version: 2.0

Status: ACTIVE

Questo documento descrive il comportamento operativo dell'agente di sviluppo di Kyro.

Non descrive il prodotto.

Descrive il modo corretto di lavorare.

---

# Startup

Ad ogni nuovo ciclo eseguire SEMPRE questi passi.

1.

Leggere

docs/10-KYRO_EVOLUTION_CONTRACT.md

completamente.

Mai utilizzare versioni memorizzate.

---

2.

Leggere

docs/20-KYRO_CHECKLIST.md

completamente.

---

3.

Individuare

la prima attività

non completata.

Ordine di priorità

IN_PROGRESS

↓

VERIFYING

↓

TODO

Mai saltare una priorità.

---

# Gap Analysis

Prima di modificare qualsiasi file produrre sempre una Gap Analysis.

Formato obbligatorio.

## Current

Come funziona oggi.

## Problem

Perché non soddisfa il Contract.

## Target

Come dovrebbe funzionare.

## Plan

Qual è la modifica minima necessaria.

Mai iniziare direttamente dal codice.

---

# Implementation Rules

Implementare esclusivamente

la modifica minima necessaria.

Mai:

- riscrivere sottosistemi stabili

- cambiare paradigma

- introdurre un secondo modello applicativo

- aumentare complessità senza motivo

---

Ogni implementazione deve

migliorare

almeno

una proprietà del sistema.

---

# Coding Rules

Ogni modifica deve:

- preservare compatibilità

- preservare Preview

- preservare Runtime

- preservare Export

- preservare Undo

- preservare Graph

---

Mai modificare

più aree contemporaneamente

senza necessità.

---

# Testing

Dopo ogni implementazione.

Sempre.

1.

Unit Test.

---

2.

Integration Test.

---

3.

Visual Test

quando richiesto.

---

4.

Product Test

quando richiesto.

---

Mai saltare test.

---

# Evidence

Ogni attività completata deve produrre prove.

Per esempio

- screenshot

- report

- trace

- build

- log

- manifest

Le prove devono essere riproducibili.

---

# Checklist Update

Aggiornare solamente

docs/20-KYRO_CHECKLIST.md

Mai modificare

10-KYRO_EVOLUTION_CONTRACT.md

durante lo sviluppo normale.

---

Una checkbox diventa

DONE

solo quando

implementazione

+

test

+

prove

sono tutti presenti.

---

# Blocked

Se una modifica richiede

una decisione di prodotto

interrompere il ciclo.

Aggiornare lo stato

BLOCKED.

Descrivere

esattamente

la decisione richiesta.

Mai inventare una soluzione.

---

# Compatibility

Ogni ciclo deve verificare

che

nessuna Demo

sia stata danneggiata.

Compatibilità

ha priorità

rispetto

alle nuove feature.

---

# Scope

Ogni ciclo affronta

una sola area.

Mai

più aree

contemporaneamente.

Eccezioni

solo

quando strettamente necessarie.

---

# Fine del ciclo

Terminare ogni ciclo producendo sempre

questo report.

## Area

Nome dell'area.

---

## Stato

TODO

IN_PROGRESS

VERIFYING

DONE

BLOCKED

---

## File modificati

Elenco completo.

---

## Decisioni

Decisioni prese.

---

## Test

Test eseguiti.

---

## Evidenze

Prove prodotte.

---

## Compatibilità

Verifiche effettuate.

---

## Regressioni

Eventuali regressioni.

---

## Checklist

Checkbox aggiornate.

---

## Next Step

Prima attività successiva.

---

# Golden Rules

Mai rompere

compatibilità.

Mai creare

un secondo modello applicativo.

Mai rendere

Codex obbligatorio.

Mai modificare

direttamente il Graph.

Mai bypassare

Transaction Engine.

Mai bypassare

Verification.

Mai bypassare

Security.

Mai dichiarare

DONE

senza prove.

---

# Success

Il successo di un ciclo NON è

scrivere codice.

Il successo di un ciclo è

ridurre

la distanza

fra

Kyro attuale

e

Kyro definito

nel Contract.