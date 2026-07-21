# Codex session evidence

- Main Codex Session ID: `019f7465-48aa-78e3-8531-1e4b6342b31e`
- Session started: 18 July 2026
- Model recorded by local Codex session metadata: `gpt-5.6-sol`
- Provider: OpenAI
- Surface: Codex CLI plus Kyro's embedded Codex/Live Bridge integration

The private raw session log is intentionally not committed because it can contain user prompts, local paths, and tool output. The session ID above is the value supplied for the Build Week `/feedback` requirement.

Codex contributions include repository analysis, the unified visual-graph and agent tool design, implementation fixes, unit/E2E tests, headed browser validation, Android build/deployment, visual inspection, release documentation, and reproducible evidence collection. Human-directed decisions include Kyro's frontend-first model, local-first storage, explicit capability approvals, open project format, and independent export requirement.

## Current measured orchestration evidence

Kyro no longer has a deterministic or local planning fast path. **Ask Codex always invokes authenticated Codex.** Skills supply procedural context and typed graph tools; the Capability Resolver reports alternatives but does not replace model reasoning.

The headed live smoke test uses the editor as a user: create a blank project, add a page and button, right-click **Ask Codex**, request a label change, approve the typed plan, observe the real preview, and undo. Both runs below used a 5,220-byte indexed graph context and the same request on the same machine and session.

| Apply orchestration | Time | Input tokens | Output tokens | Total | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Separate apply, validate and capture tools | 41.729 s | 151,647 | 1,131 | 152,778 | Revision 3, preview verified, undo verified |
| Atomic `kyro_apply_verified_transaction` | 22.642 s | 76,711 | 1,112 | 77,823 | Revision 3, preview verified, undo verified |

Observed reduction: **45.7% elapsed time** and **49.1% total tokens**. This is a single-scenario engineering A/B, not a general Kyro-versus-repository performance claim. The artifact set is `artifacts/codex-graph-smoke/` and includes the approved plan, applied preview, undo screenshot, and `evidence.json`.

The comparison intentionally measures orchestration while holding the indexed graph context constant. A classic repository scan is not a matched substitute for an active visual graph stored in local project state, so the repository makes no broader speed-up or token-saving claim. Any future general benchmark must use an equivalent serialized fixture, repeated task families, raw telemetry, failures, and confidence limits.

## Fresh Kyro 2.0 release acceptance

On 21 July 2026 the headed browser test was repeated against authenticated Codex/GPT-5.6 from a clean installation of the packed CLI. The selected-button request used 5,244 bytes of indexed context, completed planning in 17.009 seconds with 18,468 model tokens, applied the verified transaction in 1.674 seconds, and passed rendered-label and undo checks.

A second live request deliberately exceeded the installed skill set: generate a signed PDF invoice containing a QR code and deliver it through SMTP. Codex received 5,254 bytes of graph context and produced a reviewed global capability draft in 41.427 seconds using 56,218 model tokens. Kyro did not install dependencies or claim that the missing implementation worked. The draft remains explicitly inactive until implementation, security review, and evidence exist.

The sanitized machine-readable record is [`docs/benchmarks/2026-07-21-live.json`](./docs/benchmarks/2026-07-21-live.json). Public screenshots show the real approval UI and global registry; raw Codex output and browser profiles remain private because they can contain local paths and session data.
