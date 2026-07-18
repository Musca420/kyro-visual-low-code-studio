const { createHash, sign } = require("node:crypto");
const { readFile, writeFile } = require("node:fs/promises");
const { signedPayload } = require("../electron/updatePolicy.cjs");

async function main() {
  const [artifactPath, version, channel, platform, arch, url, privateKeyPath, outputPath] = process.argv.slice(2);
  if (!outputPath) throw new Error("Uso: node scripts/sign-update.cjs <artefatto> <versione> <canale> <piattaforma> <arch> <url-https> <chiave-privata-pem> <manifest.json>");
  const [artifact, privateKey] = await Promise.all([readFile(artifactPath), readFile(privateKeyPath, "utf8")]);
  const manifest = {
    version, channel, publishedAt: new Date().toISOString(), platform, arch, url,
    sha256: createHash("sha256").update(artifact).digest("hex"), size: artifact.length,
  };
  manifest.signature = sign(null, Buffer.from(signedPayload(manifest)), privateKey).toString("base64");
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
