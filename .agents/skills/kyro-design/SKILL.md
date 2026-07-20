---
name: kyro-design
description: Design and refine Kyro pages and components through the indexed visual graph. Use for layout, hierarchy, text, assets, typography, color, spacing, responsive styles, interaction states, animation, accessibility and semantic intent.
---

# Kyro Design

1. Start with `$kyro-live-context`; never scan project files.
2. Preserve stable component IDs and the selected element's semantic intent.
3. Express every change with registered design operations. Use parent/child layout before manual offsets.
4. Set desktop, tablet and mobile rules explicitly when the outcome differs by breakpoint.
5. Include hover, focus, active and disabled states where relevant, plus an accessible name and sufficient contrast.
6. Apply the approved operations as one transaction, validate, then inspect the captured preview.
7. If the request requires behavior, data or unsupported code, hand off to `$kyro-actions`, `$kyro-data` or `$kyro-extensions` without inventing a visual success.
