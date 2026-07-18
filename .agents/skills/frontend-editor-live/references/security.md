# Security

- Accettare solo bridge locale e workspace già associato al progetto.
- Validare dimensione, schema, project ID e revision di ogni richiesta.
- Non leggere o inviare token, password, file esterni al workspace o contenuti sensibili negli screenshot.
- Non usare endpoint visuali per shell, `eval` o codice arbitrario.
- Richiedere conferma per delete, dipendenze, rete, servizi e infrastruttura.
- Usare `plan` read-only prima di `apply`; annullare se progetto, pagina o revisione cambiano.
- Registrare richiesta, operazioni, file, test ed esito; mantenere l’intera richiesta annullabile come transazione.
