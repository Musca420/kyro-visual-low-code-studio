# Kyro — FlutterFlow capability gap audit

Updated: 19 July 2026. This audit uses FlutterFlow's public repositories and official documentation as a behavioral benchmark. FlutterFlow's proprietary builder source is not public; Kyro does not copy its code, assets, visual identity, or interface.

## Product position

**Kyro — Visual Low-Code Studio** is local-first and graph-native. Design, events, flows, data, services, native capabilities, generated code, runtime evidence, and agent transactions are different views of one open project. English is the primary product language; project content can use any locale.

## Verified gap matrix

| Capability | FlutterFlow baseline | Kyro today | General gap to close | Kyro acceptance test |
|---|---|---|---|---|
| Visual design | Widget palette, widget tree, reusable/theme widgets, responsive canvas | Open component tree, direct manipulation, grid/flex controls, responsive styles, reusable blocks | Better discoverability and preview-equivalent component states | A zero-code user builds and resizes a responsive multi-column screen and can see every linked behavior in Design |
| Component actions | Actions tab opens the flow bound to the selected widget | Events are stored on components and shown in Program connections | Add an explicit **Actions** tab, event catalog per component, and one-click flow creation | Select a button → Actions → On click → create/reuse flow without searching global flows |
| Event catalog | Tap, double tap, long press, submit/change, page lifecycle, keyboard, drag/pan/scale/swipe and device events | Click, change, submit, page load, timer, record action | Typed trigger registry, gesture payloads, lifecycle and viewport/system events | Long-press and swipe flows run equivalently in preview, web export and Android |
| Action flow | Node editor, condition, loop, parallel branches, action configuration | Typed flow graph, conditions, switch, loop, CRUD, API, UI and debug | Parallel node, reusable flow/action blocks, typed parameters/returns and event-root navigation | Reuse one validated flow from two components; run parallel branches; inspect values at every node |
| Widget/flow relationship | Widget binding, trigger selector and widget-local issue list | Bidirectional graph inspection exists, but the Flow workspace starts from a global flow list | Page → component → event should be the primary Flow navigator; global reusable flows remain available | Selecting any page/component/event opens the exact graph and shows missing actions or errors |
| State and expressions | App/page/component state, enums, custom types and variable binding | Global state plus node state and schema-bound records | Page/component scope, typed variables, expressions and derived state | Define typed state visually and bind it to style, visibility, content and a condition |
| Data/backend | Firebase, Supabase, REST, SQLite/local state, auth, storage, streaming | IndexedDB, REST, generated Node backend, CRUD, roles and SSE | Provider catalog, SQL migrations, storage, realtime/WebSocket, advanced query builder | Build searchable CRUD with auth and storage without code; export continues independently |
| Native device access | Permissions and custom/native extension routes | Android export, local notifications and basic manifest permissions | Capability catalog and typed nodes for camera, media, location, Bluetooth, contacts, sensors, haptics, share, clipboard, filesystem and device info | Add a capability visually; resolver adds only required packages/permissions; denial follows an explicit flow branch |
| Platform conditions | Platform build settings and custom code | Web/PWA/Android target | Typed platform/OS/version/device condition node | “Android 15 or newer” branches correctly and is visible in the flow |
| Notifications | Push plus custom local notification integration | Local notification node proven on Android | Push provider flow, channels, deep-link payload and permission education | Schedule local notification offline and receive a push test when provider credentials exist |
| Custom code/packages | Custom functions/actions/widgets, package dependencies and native configuration | Protected transformations and declarative plugins | Typed extension modules, dependency proposal, compatibility/security review, explicit approval, install transaction and rollback | Codex proposes a package, explains impact, installs only after approval, builds/tests it, and undo removes it |
| Agent integration | CLI/MCP project tools, project snapshot, plan/history/status and design scripting | Live Bridge, structured context, revisions, transactions, screenshot/log evidence and in-app Codex | Capability-indexed context and skill routing for native/integration/extension tasks | Agent resolves selected component → event → flow → capability without repository-wide analysis |
| Test/runtime | Preview, Test/Run/Local Run, hot reload, inspect mode, device session and debug variables | Interactive preview, logs, screenshots, Android build/device test | Preview→Design inspect selection, live variables, capability diagnostics and multi-device matrix | Click a runtime element to select its design node; inspect state and flow trace on device |
| Collaboration/versioning | Project history and branching | Local versions and transactional undo | Named branches/merge UI and graph-aware conflict resolution | Concurrent changes report component/flow conflicts and can be merged without losing unrelated work |
| Localization | Multiple languages and locale-aware formats | Project text is unrestricted but editor UI is mostly Italian | English-primary product localization plus project locale resources and formatters | Switch editor language without changing project content; export two project locales |
| Deployment | Web/mobile builds, store preparation and screenshots | Open web/PWA/Android export and real APK build | Store metadata, signing wizard, release tracks, crash/analytics providers | Produce a validated release checklist and unsigned/signed artifacts with honest blockers |

## Delivery modules

1. **Identity and localization** — Kyro branding, English-primary UI, compatibility aliases for existing projects and CLI.
2. **Action model** — typed event registry, Design Actions tab, page/component/event Flow navigator, reusable flows and parallel execution.
3. **Native capability registry** — permission metadata, platform/version support, runtime node schemas and generator adapters.
4. **Core native packs** — notifications, camera/media, location/maps, Bluetooth, device/system, haptics/share/clipboard, files, contacts and sensors.
5. **Integration packs** — authentication, database/storage, realtime, payments, maps, analytics, AI/media services and push notifications.
6. **Extension transactions** — proposed dependency → plain-language impact → explicit approval → install/build/test → revision/undo.
7. **Agent skills** — live graph, actions, native, integrations, extensions, testing and publishing; load only the capability reference relevant to the selected graph node.
8. **Runtime parity** — preview, web/PWA and Android use the same flow semantics; unsupported preview capabilities show an honest simulator/diagnostic instead of fake success.

## Official benchmark sources

- [FlutterFlow GitHub organization](https://github.com/FlutterFlow)
- [FlutterFlow documentation repository](https://github.com/FlutterFlow/flutterflow-documentation)
- [App Builder](https://docs.flutterflow.io/flutterflow-ui/builder/)
- [Widget Palette](https://docs.flutterflow.io/flutterflow-ui/widget-palette/)
- [Actions and Action Flow Editor](https://docs.flutterflow.io/resources/functions/action-flow-editor/)
- [Action Triggers](https://docs.flutterflow.io/resources/functions/action-triggers/)
- [Project permissions and platform settings](https://docs.flutterflow.io/resources/projects/settings/project-setup/)
- [Custom Code](https://docs.flutterflow.io/concepts/custom-code/)
- [Native SDKs and Method Channels](https://docs.flutterflow.io/concepts/advanced/method-channels/)
- [Testing and Local Run](https://docs.flutterflow.io/testing/run-your-app/)
- [Build with AI agents](https://docs.flutterflow.io/flutterflow-cli/build/)
- [Third-party integrations](https://docs.flutterflow.io/integrations/)
- [Localization](https://docs.flutterflow.io/concepts/localization/)

