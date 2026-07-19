import { existsSync } from "node:fs";

const azure = Boolean(process.env.AZURE_CODE_SIGNING_DLIB && process.env.AZURE_METADATA_JSON && process.env.AZURE_CLIENT_ID && process.env.AZURE_TENANT_ID);
const certificate = Boolean(process.env.WINDOWS_CERTIFICATE_FILE && existsSync(process.env.WINDOWS_CERTIFICATE_FILE));
if (!azure && !certificate) {
  console.error("Signed release refused: configure Azure Artifact Signing or WINDOWS_CERTIFICATE_FILE. Unsigned installers are development artifacts only.");
  process.exit(1);
}
console.log(`Windows signing ready: ${azure ? "Azure Artifact Signing" : "Authenticode certificate"}.`);
