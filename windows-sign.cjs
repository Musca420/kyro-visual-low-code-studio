const { existsSync } = require("node:fs");

function signingConfiguration() {
  if (process.env.AZURE_CODE_SIGNING_DLIB && process.env.AZURE_METADATA_JSON) {
    return {
      ...(process.env.SIGNTOOL_PATH ? { signToolPath: process.env.SIGNTOOL_PATH } : {}),
      signWithParams: ["/v", "/debug", "/dlib", process.env.AZURE_CODE_SIGNING_DLIB, "/dmdf", process.env.AZURE_METADATA_JSON],
      timestampServer: "http://timestamp.acs.microsoft.com",
      hashes: ["sha256"],
      description: "Kyro — Visual Low-Code Studio",
    };
  }
  const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE;
  if (certificateFile && existsSync(certificateFile)) {
    return {
      certificateFile,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      timestampServer: process.env.WINDOWS_TIMESTAMP_SERVER || "http://timestamp.digicert.com",
      hashes: ["sha256"],
      description: "Kyro — Visual Low-Code Studio",
    };
  }
  return undefined;
}

module.exports = signingConfiguration();
