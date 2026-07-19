---
name: frontend-editor-test
description: Verify a live Frontend Editor project as a real user through preview, screenshots, runtime logs, flow traces, validation errors, responsive breakpoints, keyboard navigation, persistence, offline behavior and editor-preview-export comparison. Use after any substantive visual, behavior or data change.
---

# Frontend Editor Test

1. Validate the graph before preview.
2. Open preview and test the requested user path, including invalid and empty cases.
3. Inspect runtime state, flow logs, validation and console errors.
4. Check desktop, tablet and mobile plus keyboard focus.
5. Capture evidence before and after; never infer success from a toast alone.
6. For persistence, close and reopen the project and repeat the observation.

Use `$frontend-editor-live`; use Browser only inside preview or an independently running export. Read [references/test-tools.md](references/test-tools.md).
