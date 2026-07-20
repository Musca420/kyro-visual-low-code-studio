# Codex session evidence

- Main Codex Session ID: `019f7465-48aa-78e3-8531-1e4b6342b31e`
- Session started: 18 July 2026
- Model recorded by local Codex session metadata: `gpt-5.6-sol`
- Provider: OpenAI
- Surface: Codex CLI plus Kyro's embedded Codex/Live Bridge integration

The private raw session log is intentionally not committed because it can contain user prompts, local paths, and tool output. The session ID above is the value supplied for the Build Week `/feedback` requirement.

Codex contributions include repository analysis, the unified visual-graph and agent tool design, implementation fixes, unit/E2E tests, headed browser validation, Android build/deployment, visual inspection, release documentation, and reproducible evidence collection. Human-directed decisions include Kyro's frontend-first model, local-first storage, explicit capability approvals, open project format, and independent export requirement.

## Kyro skill fast-path measurements

The persisted NexusField transaction timeline was inspected on 20 July 2026. These values measure the local compact-context-to-typed-plan stage only; they do not represent remote model response time or total feature implementation time.

| Transaction | Operations | Plan latency |
| --- | ---: | ---: |
| Revenue chart data, properties, and flow binding | 25 | 338 ms |
| Review submit with validation, save, refresh, success, and error | 14 | 296 ms |
| Message submit with validation, save, refresh, success, and error | 14 | 282 ms |
| Guarded refund mutation | 12 | 281 ms |
| Camera completion flow | 12 | 293 ms |
| QR/barcode permission and action flow | 12 | 624 ms |

The measurement is intentionally narrow: registered Kyro skills can use stable graph IDs and typed operations without scanning the repository. Ambiguous or custom requests still use the full Codex reasoning path and depend on model and network latency.
