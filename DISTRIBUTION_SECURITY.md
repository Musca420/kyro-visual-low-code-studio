# Kyro public distribution security

Public Windows releases must be signed. `npm run desktop:make` creates a development artifact; it is never a public release. `npm run desktop:make:signed` refuses to run without a configured signing identity and verifies both the packaged `kyro.exe` and Squirrel installer with `Get-AuthenticodeSignature`.

## Supported signing identities

1. Azure Artifact Signing: set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_METADATA_JSON`, `AZURE_CODE_SIGNING_DLIB`, and optionally `SIGNTOOL_PATH` in the release environment.
2. Traditional Authenticode: set `WINDOWS_CERTIFICATE_FILE`, `WINDOWS_CERTIFICATE_PASSWORD`, and optionally `WINDOWS_TIMESTAMP_SERVER` in the release environment.

Never commit signing credentials or certificates. The Forge configuration signs the packaged executables and the Squirrel maker signs the installer/update artifacts. The release command then rejects missing, invalid, expired, or untrusted signatures.

For consumer distribution with no certificate management, package Kyro as MSIX and publish through Microsoft Store; Microsoft signs accepted MSIX packages. Store enrollment, publisher identity verification, Azure signing, and CA certificates require an external account and may require payment, so they cannot be completed from source code alone.
