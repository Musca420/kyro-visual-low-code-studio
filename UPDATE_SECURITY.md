# Aggiornamenti desktop sicuri

Frontend Editor non installa aggiornamenti provenienti da un URL arbitrario. Il canale desktop è disabilitato finché non vengono configurati:

- `FRONTEND_EDITOR_UPDATE_MANIFEST_URL`: manifest servito esclusivamente via HTTPS;
- `FRONTEND_EDITOR_UPDATE_PUBLIC_KEY`: chiave pubblica Ed25519 PEM incorporata nel canale di release;
- `FRONTEND_EDITOR_UPDATE_CHANNEL`: `stable`, `beta` o `nightly` (predefinito `stable`).

Il manifest firmato contiene versione SemVer, canale, data, sistema, architettura, URL HTTPS, SHA-256 e dimensione dell'artefatto. La shell rifiuta firma errata, canale/piattaforma/architettura differenti, downgrade, tipo o dimensione non consentiti e data futura. `verifyUpdateArtifact` confronta dimensione e hash prima che un installer possa essere consegnato al meccanismo nativo.

Generazione manifest in un ambiente di release protetto:

```powershell
npm run update:manifest -- .\FrontendEditor-1.2.0.exe 1.2.0 stable win32 x64 https://updates.example.com/FrontendEditor-1.2.0.exe .\release-ed25519-private.pem .\win32-x64.json
```

La chiave privata non deve mai entrare nel repository o nel pacchetto. La firma Ed25519 del canale non sostituisce la firma del codice richiesta dal sistema operativo: Windows Authenticode e Apple Developer ID/notarizzazione richiedono certificati e identità esterne. Linux deve pubblicare pacchetti tramite repository firmato. In assenza di tali credenziali il codice e i test di rifiuto sono verificabili, ma una release pubblica non può essere dichiarata firmata.

`tests/updatePolicy.test.ts` genera una coppia effimera, accetta manifest/artefatto validi e riprova firma alterata, canale errato, downgrade e hash non corrispondente. La shell mostra lo stato “disponibile” solo dopo la verifica; un canale configurato ma non valido appare come “aggiornamento rifiutato”.
