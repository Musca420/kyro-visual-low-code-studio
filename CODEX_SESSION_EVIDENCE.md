# Codex session evidence

- Main Codex Session ID: `019f7465-48aa-78e3-8531-1e4b6342b31e`
- Session started: 18 July 2026
- Model recorded by local Codex session metadata: `gpt-5.6-sol`
- Provider: OpenAI
- Surface: Codex CLI plus Kyro's embedded Codex/Live Bridge integration

The private raw session log is intentionally not committed because it can contain user prompts, local paths, and tool output. The session ID above is the value supplied for the Build Week `/feedback` requirement.

Codex contributions include repository analysis, the unified visual-graph and agent tool design, implementation fixes, unit/E2E tests, headed browser validation, Android build/deployment, visual inspection, release documentation, and reproducible evidence collection. Human-directed decisions include Kyro's frontend-first model, local-first storage, explicit capability approvals, open project format, and independent export requirement.

## Classic versus skill-routed measurements

The persisted NexusField transaction timeline was inspected on 20 July 2026. Of 200 stored entries, 195 were completed. The comparison below filters one consistent task family: prompts that connect a visual component to an existing data source. Classic plans are completed model-path jobs longer than five seconds; skill plans are completed deterministic context-path jobs shorter than two seconds. Both ran on the same machine and development session.

| Stage | Samples | Minimum | Median | p90 | Maximum | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Classic Codex plan | 28 | 15.367 s | 18.079 s | 21.747 s | 22.581 s | 18.849 s |
| Kyro skill plan | 33 | 0.271 s | 0.292 s | 0.325 s | 0.338 s | 0.298 s |
| Shared transaction apply | 61 | 1.936 s | 2.470 s | 2.907 s | 3.290 s | 2.503 s |

Median planning speed-up is **61.9×**. Adding the common apply median estimates **20.549 seconds** for the classic path and **2.762 seconds** for the skill path, or **7.4× end to end**.

This is a historical cohort comparison of the same operation class, not an identical-prompt randomized benchmark. The end-to-end values sum stage medians rather than pairing individual runs. The classic jobs already received compact graph context; a whole-repository scan was not measured and cannot discover live IndexedDB state by itself. These limitations make the result useful but intentionally narrower than a general Codex performance claim.

The following examples measure the local compact-context-to-typed-plan stage only; they do not represent remote model response time or total feature implementation time.

| Transaction | Operations | Plan latency |
| --- | ---: | ---: |
| Revenue chart data, properties, and flow binding | 25 | 338 ms |
| Review submit with validation, save, refresh, success, and error | 14 | 296 ms |
| Message submit with validation, save, refresh, success, and error | 14 | 282 ms |
| Guarded refund mutation | 12 | 281 ms |
| Camera completion flow | 12 | 293 ms |
| QR/barcode permission and action flow | 12 | 624 ms |

The measurement is intentionally narrow: registered Kyro skills can use stable graph IDs and typed operations without scanning the repository. Ambiguous or custom requests still use the full Codex reasoning path and depend on model and network latency.
