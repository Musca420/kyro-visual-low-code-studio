# Kyro 2.1 rollback

Kyro 2.1 keeps project `formatVersion: 1`, so existing projects remain readable by the previous supported release. Always create a Kyro backup before changing the editor version.

## Editor rollback

1. In Kyro Home, choose **Backup all data** and keep the generated file outside the repository.
2. Stop the running Kyro process.
3. In a separate checkout, select the previous release without changing the current working tree:

   ```bash
   git clone https://github.com/Musca420/kyro-visual-low-code-studio.git kyro-rollback
   cd kyro-rollback
   git switch --detach v2.0.0
   npm ci --omit=dev
   npm link
   kyro --version
   ```

4. Start `kyro --home`. Restore the backup only if the existing browser profile is unavailable.

The current checkout and its uncommitted files are not reset or overwritten. Returning to 2.0.0 consists of relinking from the separate 2.0.0 checkout.

## Generated product rollback

- Keep each Web/PWA ZIP or Android APK produced by the Publish panel together with its Artifact Registry hash.
- Redeploy the last verified artifact; do not regenerate it from a different graph revision.
- Verify its SHA-256 against the corresponding evidence manifest before deployment.

## Verification

`npm run release:verify` proves that the package and lockfile agree on the release version, the rollback target is documented, and every bundled evidence file matches its SHA-256. Compatibility with legacy project formats is covered by the model, backup/restore and product round-trip tests in `npm run check`.
