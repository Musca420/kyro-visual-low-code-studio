# Project model

`src/model.ts` e `project.frontend-editor.json` sono la source of truth. Il codice esportato è derivato.

- `project.id` e `page.id` identificano progetto e pagina.
- `project.revision` cresce a ogni modifica del modello.
- `pages[].components[]` contiene ID stabile, tipo, nome, proprietà, stili desktop/tablet/mobile, eventi, binding e accessibilità.
- `flows[]` contiene nodi ed edge con percorsi success/error.
- `dataSources[]` dichiara provider, schema e capability; i segreti non appartengono al modello.

Conservare gli ID durante spostamenti e modifiche. Creare nuovi ID solo per entità nuove o duplicate. Validare sempre con lo schema Zod e i riferimenti prima della preview.
