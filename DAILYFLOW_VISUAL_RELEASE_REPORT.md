# DailyFlow visual release report

Date: 19 July 2026. Product under test: **Kyro — Visual Low-Code Studio**. The project was created and changed through the visible editor, Preview, Flow, Data, Publish, and **Ask Codex** controls. Browser automation only reproduced actions available to a user; it did not insert components, project JSON, or records directly.

## User journey

1. Started Kyro from the repository and opened the saved nine-page DailyFlow project.
2. Built and reviewed Home, Tasks, Profile, Onboarding, Calendar, Task Details, Habits, Statistics, and Settings from the visual canvas.
3. Used component context and Ask Codex to create and revise local task/habit data surfaces, reusable flows, local notifications, calendar/statistics bindings, and Android settings.
4. Selected pages, layers, and Inspector fields to correct visible content; the final project contains no `Contatti` footer text.
5. Used Preview to create eleven tasks and three habits, then tested search, status filtering, completion, delete confirmation, undo, calendar/statistics refresh, notification feedback, save, close, and reopen.
6. Exported from the visible **Export app** control, installed dependencies in a clean extracted folder, built it, and started it separately at `http://127.0.0.1:43213`.
7. In the standalone export, created `Release persistence check` through the visible form, reloaded, searched it, completed it, deleted it with confirmation, used Undo, reloaded again, and confirmed persistence.
8. Built the real Android APK, installed it as an update on `emulator-5554`, created `Offline launch test` from the Android UI, disabled networking, force-stopped/relaunched, and confirmed offline persistence. The record also survived an APK update.

## Visual flows and data

- Tasks: page load → local query → list refresh; form submit → read fields → validate name/date → local insert → refresh → success/error; record update and delete flows with refresh and error branches.
- Habits: local load/create/complete flows with streak updates.
- Settings: change event → local notification → feedback.
- Calendar and Statistics: page-scoped refresh flows bound to task and habit data.
- Local IndexedDB sources provide real CRUD; the exported app owns its independent database.
- Flow context resolves page and component from stable IDs and shows the same elements used in Design. Reusable `Run flow` nodes support shared subflows with cycle/depth guards.

## Responsive, keyboard, and runtime verification

- Desktop: 1280×820; tablet: 834×1112; mobile: 390×844.
- Tablet and mobile horizontal overflow: `0px`.
- Native form validation rejects an empty required task name; form fields, links, record actions, and editor controls are keyboard reachable with visible focus styles.
- Android safe area, bottom navigation, overflow menu, keyboard resize, native date picker, light/dark themes, and offline relaunch were exercised.
- Final standalone pass recorded zero console, page, and HTTP errors. An earlier `/favicon.ico` 404 was reproduced and fixed in the shared generator with an embedded icon before the export was regenerated.

## Main evidence

- Editor and graph: `artifacts/kyro-dailyflow-66-flow-english-nodes.png`, `artifacts/kyro-dailyflow-70-footer-visual-edit.png`, `artifacts/kyro-dailyflow-83-editor-english-final.png`, `artifacts/kyro-dailyflow-84-data-english-final.png`.
- Android: `artifacts/kyro-dailyflow-59-android-date-dialog.png`, `artifacts/kyro-dailyflow-62-android-offline-persisted.png`, `artifacts/kyro-dailyflow-67-android-record-contrast.png`.
- Final standalone export: `artifacts/kyro-dailyflow-77-release-task-created.png`, `artifacts/kyro-dailyflow-78-release-task-persisted.png`, `artifacts/kyro-dailyflow-79-release-tablet.png`, `artifacts/kyro-dailyflow-80-release-mobile.png`, `artifacts/kyro-dailyflow-81-release-delete-undo.png`, `artifacts/kyro-dailyflow-82-release-undo-persisted.png`, `artifacts/kyro-dailyflow-86-release-v3-final.png`.
- Release ZIP: `artifacts/exports/kyro-dailyflow-release-v3.zip`.
- Extracted runnable project: `artifacts/exports/dailyflow-release-v3-20260719`.
- Android APK: `C:\Users\david\.kyro\workspace\android-builds\512826c3-25ef-4638-a64a-c77c350951a5-1784468071550\android\app\build\outputs\apk\debug\app-debug.apk`.

## Bugs fixed during this release pass

- Codex cancellation could leave an orphaned global agent lock; cancellation now clears only the matching process and the session can recover immediately.
- Existing flow updates used the wrong operation field and could fail to rename/update nodes; the transaction plan now targets the shared operation contract.
- Mobile Android exports could overflow or lose navigation destinations; the generator now uses a bottom bar plus a More menu and safe-area-aware layout.
- Generated forms, record rows, and action buttons lacked reliable grid spacing and contrast; shared export CSS now renders readable, touch-friendly controls.
- Legacy editor and generated-runtime strings were not consistently English-first; shared Design, Flow, data, publishing, validation, and export labels were migrated.
- The final standalone export emitted a favicon 404; the shared generator now embeds a dependency-free favicon.
- `kyro --help` previously started the editor; help/version/check are now explicit non-interactive CLI paths with tests.

## Reproducible commands and results

- `npm run check`: 18 Vitest files / 112 tests, typecheck, lint, and Vite production build passed.
- `npm test -- --run tests/generator.test.ts`: 22/22 passed after the export generator fixes.
- `npm test -- --run tests/cli.test.ts`: 2/2 passed after CLI help/version support.
- `npm install && npm run build` in the final extracted export: 110 packages, 0 vulnerabilities, TypeScript and Vite build passed.
- `kyro --check` in the repository: project detected; in an ordinary folder: Home detected.

## Observed residual limits

- The physical Android phone still blocks a new APK hash through its own security UI. The same real APK was installed, updated, and tested on the authorized emulator; no physical-device installation is claimed for this final hash.
- Public Windows/macOS installers require platform signing identities and HTTPS release hosting. The supported current path is repository + global `kyro`, so no unsigned installer is presented as production-ready.
- Five zero-code personas are repeatable browser simulations, not five recruited human studies. Human observation, public signing, store publication, and native macOS/Linux smoke tests require external people or infrastructure.
- Generic folder import preserves unsupported dynamic framework code for progressive conversion; arbitrary React/Vue/Svelte code is not claimed as fully bidirectional visual source.
