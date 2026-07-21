# Dependency security status

Measured from `package-lock.json` on 2026-07-21. Runtime and complete-toolchain results are reported separately.

## Release summary

| Scope | Dependencies | Critical | High | Total advisories | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| Runtime (`npm audit --omit=dev`) | 197 production | 0 | 0 | 0 | Verified |
| Complete toolchain (`npm audit`) | 439 total | 0 | 0 | 0 | Verified |
| CLI package | 95 files, 0 bundled dependencies | 0 | 0 | 0 | Verified |
| Desktop installer | Not distributed | — | — | — | Removed |

## Decision

Kyro is supported through the cross-platform `kyro` CLI and the local browser UI. The non-working, unsigned Electron installer was removed together with its Forge build pipeline, tests and dependencies. This does not remove editor, Live Bridge, Codex, Preview, web export, PWA export or Android export behavior.

Before removal, Electron Forge transitively introduced 25 development/packaging findings (1 critical, 21 high, 3 low) through `tar` and `tmp`. Those packages were not present in the CLI runtime or unpacked desktop application, but keeping an unsupported release channel added risk without user value. After removing that channel, both audit scopes report zero advisories without `npm audit fix --force`, dependency overrides or a breaking package upgrade.

## Distribution evidence

- `npm audit --json`: zero advisories across 439 dependencies.
- `npm audit --omit=dev --json`: zero advisories across 197 production dependencies.
- `npm pack --dry-run --json`: 95 files, 1,086,524 unpacked bytes, `bundled: []`.
- The package file list contains no tests, browser profile, local report, signing key, installer or desktop shell.
- CI stores both audit JSON reports, blocks runtime high/critical advisories, runs `npm pack --dry-run`, and executes the full product verification.

## Release policy

Re-run both audits and inspect the package file list for every release. Do not publish “zero vulnerabilities” without naming the measured scope. Do not use `npm audit fix --force` or unverified dependency overrides.
