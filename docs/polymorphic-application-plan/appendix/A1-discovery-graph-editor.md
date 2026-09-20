# Plastic-IO Graph Editor — current-state discovery record

Repo: `/Users/tonygermaneri/gh/graph-editor`, commit `93d69d7d43c924d400f2aaec4b8831d411fd3497`, branch `main`, working tree clean.
Survey date: 2026-09-20. Toolchain used for the test runs: node v25.7.0, npm 11.10.1 (CI pins Node 18, see A.4).

Verification legend used throughout: **[read]** static read of the cited lines; **[trace]** call chain followed across the cited files; **[grep]** exhaustive `grep -rn` over `src/` and `packages/` (excluding `node_modules`); **[run]** command executed in this session. Line numbers are from `cat -n` on the files at the commit above. No project files were modified.

---

## A. Inventory

### A.1 Manifests

Root `package.json` (`/Users/tonygermaneri/gh/graph-editor/package.json`) [read]:
- `name: graph-editor`, `version: 2.0.0`, `private: true`, `workspaces: ["packages/*"]` (lines 2-7).
- Scripts (lines 8-24): `dev` (vite), `build` (`run-p build-only` → `vite build`), `test:unit` (vitest jsdom rooted at `src/`), `test:crdt` (`vitest run --config vitest.packages.config.ts`), `test:integration` (`vitest.integration.config.ts`), `test:e2e` / `test:e2e:dev` (cypress via start-server-and-test), `test:e2e:crdt` (`vitest.e2e.config.ts`), `type-check` (`vue-tsc --noEmit -p tsconfig.vitest.json --composite false`), `lint`.
- Declared dependency ranges (lines 25-64) and the versions actually installed in `node_modules` [run: `node -e require(pkg/package.json).version`]:

| package | declared | installed | used by (import sites) [grep] |
|---|---|---|---|
| `yjs` | ^13.6.32 | 13.6.32 | GraphCrdt/*, Graph/crdt.ts, WssCrdtProvider, IndexedDBCrdtProvider, tests |
| `y-protocols` | ^1.0.7 | 1.0.7 | `packages/WssCrdtProvider/main.ts:2` (awareness only; sync protocol is hand-rolled in `GraphCrdt/protocol.ts`) |
| `y-indexeddb` | ^9.0.12 | 9.0.12 | `packages/IndexedDBCrdtProvider/main.ts:2` |
| `y-monaco` | ^0.1.6 | 0.1.6 | `packages/CodeEditor/Editor.vue:48` |
| `lib0` | ^0.2.117 | 0.2.117 | `packages/GraphCrdt/protocol.ts:1-2` |
| `@plastic-io/plastic-io` | 2.0.3 (pinned) | 2.0.3, `main: ./dist/index.js`, `types: ./dist/index.d.ts`; dist only (`dist/{index,Node,Edge,Scheduler,Shared,Loader}.{js,d.ts}`) with nested `node_modules/{escodegen,meriyah,levn,optionator,prelude-ls,type-check}` | `packages/Orchestrator/schedulerWorker.ts:1` (runtime), `packages/Input/mouse.ts:7` (`linkInnerNodeEdges` value import), `packages/Node/Node.vue:79`, `NodeField.vue:28`, `NodeEdgeConnector.vue:51` (interfaces imported as values), type-only imports in Graph/*, DocumentProvider, WssDocumentProvider |
| `openai` | ^4.11.0 | 4.11.0 | `src/main.ts:7-8` only |
| `@auth0/auth0-spa-js` | ^2.0.1 | 2.0.1 | `packages/Auth0AuthenticationProvider/main.ts:6` |
| `deep-diff` | ^1.0.2 | 1.0.2 | `packages/Graph/mutation.ts:8`, `packages/LocalUserPreferences/main.ts:3` (imported, never called), `packages/LocalStorageDocumentProvider/main.ts:10` (dead module, see J), `packages/IndexedDBDocumentProvider/storageWorker.ts:5` |
| `vue` / `pinia` / `vuetify` | ^3.3.13 / ^2.1.7 / ^3.0.2 | 3.3.13 / 2.1.7 / 3.0.2 | everywhere |
| `vite` / `vitest` / `typescript` | ^4.4.9 / ^0.34.4 / ~4.7.4 | 4.4.9 / 0.34.4 / (4.7.x) | build/test |
| `monaco-editor` | ^0.34.1 | 0.34.1 | `packages/CodeEditor/Editor.vue:50-56` |
| `vue3-sfc-loader`, `@babel/standalone`, `@babel/core`, `@babel/preset-*`, `onigasm`, `jshashes`, `htmlparser2`, `domhandler`, `domutils`, `monaco-editor-core`, `escodegen`, `meriyah` | declared | installed | **no import anywhere in `src/` or `packages/`** [grep: `from '<pkg>'` returned nothing]. `escodegen`/`meriyah` are consumed only inside `@plastic-io/plastic-io/dist/Node.js:41-42`. |
| `flatted` | ^3.2.7 | 3.2.7 | worker message (de)serialisation: `Orchestrator/main.ts:5`, `schedulerWorker.ts:3`, `IndexedDBDocumentProvider/{main,storageWorker}.ts`, `NodeComponent.vue:7`, `ConnectorInfo.vue:65`, `NodeEdgeConnector.vue:55` |

Every workspace package is `@plastic-io/graph-editor-vue3-<name>` (or `@plastic-io/graph-crdt`, `@plastic-io/graph-editor-names`), version `1.0.0`, `main: ./main.ts`, no dependencies of its own [run: loop over `packages/*/package.json`]. They resolve through npm-workspace symlinks in `node_modules/@plastic-io/` [run: `ls node_modules/@plastic-io/`]. `packages/GraphCrdt/package.json` is the one non-private package: `private: false`, `peerDependencies: yjs ^13.6.0, lib0 ^0.2.99`, `files` lists the seven `.ts` sources — it ships TypeScript source, not a build [read: lines 1-21].

### A.2 Entry points

- `src/main.ts` [read]: imports `openai` and assigns `(window as any).OpenAI = OpenAI` (7-8); creates Pinia before plugins (62), Vuetify with all components/directives (64-67), `createApp(App)` and `(window as any).plastic_app = app` (69-72); a `plugins` array of 39 module classes in load order (73-119) with comments that `Orchestrator` must come first ("provides a common store") and `LocalUserPreferences` before anything reading prefs (74-78); each is instantiated `new _Plugin({}, app, router, pinia)` and awaited if it returns a Promise (120-131); `(self as any).plastic = {app, router, pinia, plugins: pluginInstances}` (132-137, note `pluginInstances` is never populated); `app.use(router)` then `app.mount("#app")` (139-141).
- `src/router/index.ts` [read]: `createRouter({history: createWebHistory(import.meta.env.BASE_URL), routes: []})` (2-6) — routes are added by packages: `packages/Manager/main.ts:8-12` adds `/` → `GraphManager`; `packages/workspace/router.ts:11-15` adds `/:documentId` → Workspace view (and a `beforeEach` that loads `preferences.componentScripts` as `<script>` tags, 6-10); `packages/CodeEditor/router.ts:51-55` adds `/popout-editor/:documentId/:nodeId/:templateType/:language`.
- `src/App.vue` [read]: `<RouterView/>` plus a `<link>` to the MDI icon font CDN (1-7).
- `index.html` [read]: loads `https://unpkg.com/jszip@3.10.1/dist/jszip.min.js` as a global before `src/main.ts` (10-11); `JSZip` is used as a global in `packages/Graph/clipboard.ts:5` and `packages/Node/NodeEditor.vue:115`.

### A.3 Build / CI / env

- `vite.config.ts` [read]: `base: '/graph-editor/'` (8), dev port 8080 (9-11), `rollupOptions: {external: ['jszip']}` placed at the top level rather than under `build` (12-14, so Vite ignores it; harmless because jszip is a CDN global), Vue + Vuetify plugins (15-20), alias `@` → `src` (22-25), and an inline vitest `test` block (jsdom, c8 coverage excludes) (26-45).
- `.github/workflows/main.yml` [read]: on push to `main`: checkout, Node **18**, `npm install`, `npm run build`, copy `dist/index.html` → `dist/404.html` (SPA fallback), `peaceiris/actions-gh-pages@v3` publish of `./dist` (1-33). No test or type-check step in CI.
- `.env` [read]: five bare names `VITE_GRAPH_HTTP_SERVER`, `VITE_GRAPH_WSS_SERVER`, `VITE_AUTH_DOMAIN`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_AUDIENCE` with no values (1-6). The only `import.meta.env` read in the codebase is `import.meta.env.BASE_URL` at `src/router/index.ts:3` [grep], so these variables are **never consumed**; server/auth configuration comes from user preferences (D.7).
- `tsconfig.app.json` includes `packages/**/*` and `src/**/*` (3-9); `tsconfig.vitest.json` extends it with `types: ["node","jsdom"]` and `lib: []` (1-9); no `allowJs` [read].
- A `dist/` build from 2026-09-20 10:55 exists locally (gitignored) [run: `ls -la dist`].

### A.4 Test configuration

- `vitest.packages.config.ts` [read]: `include: packages/**/__tests__/**/*.spec.ts`, `environment: node` (3-6).
- `vitest.integration.config.ts` [read]: `packages/**/__integration__/**/*.spec.ts`, jsdom, Vue plugin, `server.deps.inline: ['vuetify']` (5-14).
- `vitest.e2e.config.ts` [read]: `packages/**/__e2e__/**/*.spec.ts`, node, `testTimeout: 300000` (long-running stress; not run here) (7-13).
- `cypress.config.ts` [read]: spec pattern `cypress/e2e/**/*.{cy,spec}.*`, `baseUrl: http://localhost:4173` (3-8). The only spec is the scaffold `cypress/e2e/example.cy.ts` asserting `cy.contains("h1", "You did it!")` (3-8) — it cannot pass against this app (no such heading; not run).
- Spec files present [run: `ls`]: `packages/GraphCrdt/__tests__/{codec,reconcile,updates,converge}.spec.ts` + `fixtures.ts`; `packages/Graph/__tests__/{crdt,project}.spec.ts`; `packages/Graph/__integration__/store.spec.ts`; `packages/Graph/__e2e__/{stress,undoRedo}.spec.ts` + `harness.ts`. Results in section I.

### A.5 How packages register (plugin/module system)

- `packages/EditorModule/main.ts` [read]: `abstract class GraphEditorModule` whose constructor takes `(config, app, router, pinia)` and only sets `this.name = typeof this` (4-9). `class Plugin` (10-50) carries `name, component, icon, helpTopic, type, order, title, alt, divider, props`; throws if `type` or `component` is empty (43-48).
- Registration: modules call `app.component('<tag>', Component)` and `useOrchestratorStore().addPlugin(new Plugin({...}))` (`packages/Orchestrator/main.ts:375-377`), and hosts read them with `getPluginsByType(type)` sorted by `order` (370-374) [read].
- Plugin `type` values and where each is rendered [grep + read]:
  - `system-bar-top` → `packages/workspace/components/Workspace.vue:11-17`; registered by ShortcutIcons (`ShortcutIcons/main.ts:14-19`), SharedUsers (`SharedUsers/main.ts:10-18`, order 1.5), Auth0 logoff icon (`Auth0AuthenticationProvider/main.ts:47-62`).
  - `system-bar-bottom` → `Workspace.vue:31-36`; registered by ShortcutIcons (order 0), GraphPropertiesPanel menu (order -1) and Graph Code toggle (order 0) (`GraphPropertiesPanel/main.ts:16-34`), Rewind (3.5), HistoryPanel (4), ImportPanel (5), SettingsPanel (6).
  - `manager-top-bar-title` / `manager-top-bar-right` → `packages/Manager/GraphManager.vue:10-12, 15-17`; registered by ProviderSettings (`ProviderSettings/main.ts:17-25`) and Auth0 (`main.ts:31-45`).
  - `settings-panel` → `packages/SettingsPanel/SettingsPanel.vue:3-8` (each plugin gets `v-model="preferences"`); registered by Appearance ×5 (`Appearance/main.ts:19-53`), Registries (`Orchestrator/main.ts:82-88`), Auth0 (`main.ts:21-29`).
  - `library-registry-panel` → `packages/ImportPanel/ImportPanel.vue:21-24, 33-38`; GitHubProvider defines one but the `addPlugin` call is commented out (`GitHubProvider/main.ts:23-24`).
  - `nav-panel-graph-tabs` (`NodeListPanel/main.ts:16`) and `nav-panel-node-tabs` (`NodeEdgePropertiesPanel/main.ts:18`): **registered but no host renders these types** [grep `nav-panel`: only the two definitions]. `node-edge-properties-panel` is instead mounted directly by `packages/Node/NodeEditor.vue:67`; `node-list-panel` is never mounted anywhere [grep].
- `packages/workspace/main.ts` [read]: installs the workspace route and registers `<workspace>` (7-13); `views/Workspace.vue` is a 12-line wrapper around `<workspace/>`; `components/Workspace.vue` is the editor shell (see H.6).

### A.6 Pinia stores [grep `defineStore`]

| store id | file | notes |
|---|---|---|
| `graph` | `packages/Graph/store.ts:15-29` | state from `state.ts`; actions spread from `connectors, movement, clipboard, viewport, mutation, rewind, live, presence, text, info` |
| `graph-snapshot` | `packages/Graph/store.ts:31-37` | `{graph}` — the copy the scheduler watches |
| `orchestrator` | `packages/Orchestrator/main.ts:102-707` | plugins, providers, scheduler worker, errors, presence users, toc, registry |
| `UserPreferences` | `packages/PreferencesProvider/main.ts:48-54` | `{remotePreferences, preferences, originalPreferences}` |
| `authentication` | `packages/AuthenticationProvider/main.ts:14-33` | `identity {isAuthenticated,user,provider,token}` |
| `input` | `packages/Input/store.ts:8-164` | mouse/keys, drives `MouseAction` |
| `node` | `packages/Node/store.ts:3-7` | empty |
| `github` | `packages/GitHubProvider/store.ts:3-55` | unused (panel not registered) |

---

## B. Canonical graph model and serialization

### B.1 Where the types come from

The editor has **no local Graph/Node/Edge type definitions**; it imports the scheduler's interfaces from `@plastic-io/plastic-io` (dist `.d.ts`) — mostly as `import type` (`packages/Graph/store.ts:2`, `state.ts:1`, `connectors.ts:1`, `clipboard.ts:1`, `info.ts:1`, `viewport.ts:1`, `mutation.ts:9`, `DocumentProvider/main.ts:1`, `WssDocumentProvider/HTTPDataProvider.ts:1`) but in three components as runtime values used as Vue prop types (`packages/Node/Node.vue:79,98-100`, `NodeField.vue:28,81`, `NodeEdgeConnector.vue:51,67-69`), which resolve to `undefined` at runtime since they are interfaces [read]. `GraphCrdt/schema.ts` defines no graph TS types; it documents the Y layout in comments and exports key-name constants [read]. The graph actually built by the editor is shaped by `mutation.ts` (B.3).

Exact scheduler-side definitions (quoted from `node_modules/@plastic-io/plastic-io/dist/`) [read]:

```ts
// Shared.d.ts:85-102
export interface Graph {
    id: string;
    url: string;
    nodes: Node[];
    properties: GraphProperties;
    version: number;
}
export interface GraphProperties {
    name: string;
    description: string;
    createdBy: string;
    createdOn: Date;
    lastUpdate: Date;
    exportable: boolean;
    height: number;
    width: number;
    icon: string;
}
// Node.d.ts:4-16
export default interface Node {
    id: string;
    linkedGraph?: LinkedGraph;
    linkedNode?: LinkedNode;
    edges: Edge[];
    version: number;
    graphId: string;
    url: string;
    data: any;
    properties: any;
    template: NodeTemplate;
    __contextId: any;
}
// Edge.d.ts:4-7
export default interface Edge {
    field: string;
    connectors: Connector[];
}
// Shared.d.ts:11-52
export interface Connector { id: string; nodeId: string; field: string; graphId: string; version: number; }
export interface FieldMap { id: string; field: string; type: string; external: boolean; }
export interface NodeTemplate { set: string; }
export interface LinkedNode { id: string; version: number; node?: Node; loaded: boolean; }
export interface LinkedGraph {
    id: string; version: number; graph: Graph; loaded: boolean;
    data: { [key: string]: any; };
    properties: { [key: string]: object; };
    fields: { inputs: { [key: string]: FieldMap; }; outputs: { [key: string]: FieldMap; }; };
}
// Shared.d.ts:53-74
export interface NodeInterface {
    scheduler: Scheduler; node: Node; field: string; value: any; edges: object; state: object;
    cache: object; graph: Graph; data: any; properties: object; context: any;
}
export interface NodeSetEvent extends SchedulerEvent {
    err?: Error; return?: any; nodeInterface: NodeInterface; nodeId: string; graphId: string; field: string; setContext: Function;
}
```

Editor-local shapes:

```ts
// packages/DocumentProvider/main.ts:2-28
export interface Toc { [key: string]: TocItem; }
export interface TocItem { id: string; lastUpdate: number; type: string; description: string; icon: string; name: string; version: number; }
export interface GraphDiff { time: number; crc: number; description: string; changes: object[] }   // legacy deep-diff event
export interface NodeArtifact { node: Node; }
export interface GraphArtifact { graph: Graph; }
export interface PreferencesArtifact { preferences: any; }
```

### B.2 Shape of a node/graph as the editor creates it

`packages/Graph/mutation.ts:createNewNode` (724-771) [read] builds:
`{id, edges: [], version: graphSnapshot.version, graphId, artifact: null, url: <RandomName>, data: null, properties: {inputs: [], outputs: [], groups: [], name, description: "", createdOn, lastUpdate, tags: [], icon: "mdi-node-rectangle", positionAbsolute: false, appearsInPresentation: false, appearsInExport: false, x, y, z, presentation: {x, y, z, order}}, template: {set, vue}}`.
Inputs/outputs entries are `{name, type, external, visible}` (`connectors.ts:53-58, 72-77`); an output always has a matching `edges[]` entry `{field: name, connectors: []}` (`connectors.ts:78-81`); a connector is `{id, nodeId, field, graphId, version}` created in `packages/Input/mouse.ts:233-257` (fills `nodeId`, `field`, `graphId`, `version` from the hovered/adding node). Node `data` and `properties.scripts` (CSV of script URLs) are free-form.
`createGraph` (388-411) builds `{id, version: 0, url, nodes: [], properties: {name, description: "", exportable: false, icon: "mdi-graph", createdBy: "", createdOn, lastUpdate, height: 150, width: 300, timeout: 30000, logLevel: 2, template: preferences.defaultNewGraphTemplate}}`. `properties.scripts`, `tags`, `startInPresentationMode`, `lastUpdatedBy` are added by panels (`GraphPropertiesPanel/GraphProperties.vue:32, 40, 53, 83`).

### B.3 Yjs document layout (`packages/GraphCrdt/schema.ts`, realised in `codec.ts`) [read]

Constants: `SCHEMA_VERSION = 1` (62), `ROOT_KEY = "graph"` (65), `GRAPH_TEXT_PROPERTIES = ["template","scripts"]` (68), `NODE_TEXT_PROPERTIES = ["scripts"]` (71), `NODE_TEMPLATE_TEXT_FIELDS = ["set","vue"]` (74), `NODE_OPAQUE_FIELDS = ["data","linkedGraph","linkedNode"]` (82), `NODE_PROPERTY_CONTAINERS = ["presentation","groups","inputs","outputs"]` (85-90).

Layout as built by `codec.ts:fromJSON` (173-200):
```
doc.getMap("graph")
  <scalar root keys: id, url, version, ...>         root.set(key, scalar|clone)         codec.ts:177-183
  properties : Y.Map                                buildGraphProperties               152-167
     template, scripts : Y.Text                     newText                            160-161
     other keys        : scalar or cloned JSON
  nodes : Y.Map<nodeId, Y.Map>                      buildNode                          105-150
     id, graphId, url, artifact, version : scalars
     data, linkedGraph, linkedNode : cloned opaque JSON (replaced whole)               115-118
     properties : Y.Map                             buildNodeProperties                52-91
        presentation : Y.Map of scalars             77
        groups       : Y.Array<string>              78-81
        inputs, outputs : Y.Array<Y.Map>  (keyed by "name" on reconcile)               82-83, buildKeyedMapArray 46-50
        scripts      : Y.Text                       84-85
        other        : scalars/cloned
     edges : Y.Map<field, Y.Map>                    124-131
        field : string; connectors : Y.Array<Y.Map> (keyed by "id" on reconcile)       buildEdge 93-103
     template : Y.Map { set: Y.Text, vue: Y.Text, ...cloned }                          133-147
  meta : Y.Map { schemaVersion: 1 }                                                    195-197
```
Defaults inserted on write: `presentation {x:0,y:0,z:0}`, `groups []`, `inputs []`, `outputs []` (58-69); `template.set/vue` default `""` (134-138).

Read-back (`toJSON` 289-316): root scalars, `properties` via `readMap` (302-303), nodes via `readNode` (227-272) sorted by `compareNodes` (`properties.createdOn` then `id`, 275-282). `readNode` orders `edges` by the node's `outputs` order first, then remaining edge keys sorted (244-270). `isEmpty` (319-321) and `schemaVersionOf` (324-330). `version` is a plain LWW scalar by design (schema.ts:42-50).

### B.4 `reconcile.ts` — plain-snapshot → granular Y ops [read]

`reconcile(doc, target, origin)` (479-547): returns `false` for no target; if the doc is empty it runs `fromJSON` inside `doc.transact(..., origin)` (483-488); otherwise one transaction (491-544) that: deletes root keys absent from target and sets changed scalars using `deepEqual` (28-63) against `readValue` of the current Y value (499-514); `reconcileGraphProperties` (202-228; text keys via `reconcileText` 188-196 → `applyTextDelta`); `reconcileNodes` (436-459: delete by id, `reconcileNode` or `buildNode`); ensures `meta` (538-543). `reconcileNode` (351-434) handles scalars/opaque fields (367-379), `reconcileNodeProperties` (230-290: presentation via `reconcileScalarMap` 70-93, groups via `reconcileStringArray` 96-124 prefix/suffix splice, inputs/outputs via `reconcileKeyedMapArray(..., "name")` 131-185, scripts via text), `reconcileEdges` (292-349: keyed by `field`, connectors via `reconcileKeyedMapArray(..., "id")`), and template text fields (403-431). Every helper returns a `changed` boolean; `deepEqual` is re-exported (549) and used across the editor.

### B.5 `updates.ts` — V2 encoding [read]

`UPDATE_FORMAT = 2`, `UPDATE_EVENT = "updateV2"` (23-26). Wrappers: `encodeState` → `Y.encodeStateAsUpdateV2` (29-31), `applyUpdate` → `Y.applyUpdateV2` (33-35), `mergeUpdates` → `Y.mergeUpdatesV2` (38-43), `diffUpdate` (46-48), `stateVectorFromUpdate` → `Y.encodeStateVectorFromUpdateV2` (51-53), `encodeStateVector` (59-61), `isEmptyUpdate` via `Y.parseUpdateMetaV2(update).to.size === 0` (69-75), `documentSize` (78-80). Note (doc comment 17-19): y-indexeddb keeps listening to the V1 `update` event, so it stores V1 bytes while everything else is V2.

### B.6 `protocol.ts` — wire format [read]

```ts
// packages/GraphCrdt/protocol.ts:13-20
export const MESSAGE_SYNC_STEP1 = 0;
export const MESSAGE_SYNC_STEP2 = 1;
export const MESSAGE_UPDATE = 2;
export interface SyncMessage { type: number; content: Uint8Array; }
```
`readSyncMessage` decodes `varUint type` + `varUint8Array content` (22-27); `writeSyncStep1(stateVector)`, `writeSyncStep2(update)`, `writeUpdate(update)` (37-49); base64 helpers that use `Buffer` when present (55-82); `channelIdFor(graphId) = "graph-crdt-" + graphId` (85-87).

JSON envelope carried over API Gateway (`schema.ts:106-123`):
```ts
export interface YjsEnvelope {
  action: "yjs";
  graphId: string;
  kind: "sync" | "awareness";
  payload: string;          // base64 protocol payload
  description?: string;     // label for history/rewind
  format?: number;          // UPDATE_FORMAT
  origin?: string;          // per-connection id echoed back (declared; NOT set by the editor, see D.1)
}
export interface AwarenessState {
  user: { id: string; name: string; email?: string; avatar?: string; color: string; };
  cursor?: { x: number; y: number } | null;
  selection?: { nodes: string[]; connectors: string[] };
  presentation?: boolean;
}
```

### B.7 `text.ts` and `main.ts` [read]

`applyTextDelta(text, next)` (text.ts:14-48) trims common prefix/suffix and issues one `delete` + one `insert`; `newText` (51-58). `GraphCrdt/main.ts` re-exports everything (8-45) and defines `class LocalOrigin {description, batch}` (57-68), `class RemoteOrigin {source}` (71-79), `isLocalOrigin` (81-83) and `describeOrigin` (94-108: LocalOrigin → its description; RemoteOrigin/`{source:"seed"}` → "Start"; other `{source}` → "Remote change"; anything else → "Edit Code").

Code (`template.set`, `template.vue`, `properties.template`, `scripts`) is stored as `Y.Text`; the Monaco editor binds directly to it (`packages/Graph/text.ts:13-38` hands the `Y.Text` out; `packages/CodeEditor/Editor.vue:264-280` creates a `MonacoBinding(ytext, model, editors, awareness)`), so code edits bypass the snapshot/reconcile path entirely.

---

## C. Editing commands and mutation path

### C.1 Every action in `packages/Graph/mutation.ts` [read]

| action | lines | one-liner |
|---|---|---|
| `updateNodeUrl(e)` | 31-35 | set `node.url`, commit "Change Node URL" |
| `updateNodeProperties(e)` | 36-49 | replace `node.properties` if `deepEqual` differs, commit "Update Node Properties" (throws via `this.raiseError` if node missing) |
| `addItem(e)` | 50-98 | resolve an import payload to JSON (artifact-url + `graphHTTPServer`, `publishedGraph` via `publish.get(id)`, `component`, GitHub contents API, plain `url`, or `publish.get("artifacts/{id}.{version}")`), strip `artifact`/`url`, dispatch to `addNodeItem`/`addGraphItem`/`addComponentItem` |
| `addComponentItem(e)` | 99-181 | wrap a globally registered Vue component (`self.plastic.app._instance.appContext.components[name]`) as a node whose inputs = props, outputs = emits; commit "Import New Graph" |
| `addGraphItem(e)` | 182-288 | create a node with `linkedGraph` (full published graph embedded), `artifact: e.url || "artifacts/{id}.{version}"`, external IO mapped to `fields.inputs/outputs`; commit "Import New Graph" |
| `addDroppedItem(e)` | 289-313 | dropped JSON/zip node → new id/url/version, connectors cleared, `properties.scripts` loaded via `loadScripts`; commit "Drop New Item" |
| `addNodeItem(e)` | 314-370 | create a node with `linkedNode: e.item`, `artifact`, copied inputs/outputs/template; commit "Import New Node" |
| `undo()` / `redo()` | 371-378 | delegate to `crdtSession.undo/redo` |
| `moveHistoryPosition(move)` | 384-387 | `crdtSession.move(delta)` |
| `createGraph(id)` | 388-411 | default graph JSON (B.2) |
| `transact(description, cb)` | 412-415 | `await cb(graphSnapshot)` then commit |
| `updateGraphFromSnapshot(description)` | 423-439 | **the single commit gateway** (C.3) |
| `applyProjection(projection, info)` | 445-457 | patch `graph`, (if not local) `graphSnapshot`, and `graphSnapshotStore.graph` in place |
| `closeGraph()` | 459-484 | disconnect every `syncProviders[]`, destroy session, reset history state |
| `loadLegacyGraph(graphId)` | 486-497 | `dataProviders.graph.get(id)` for pre-CRDT graphs |
| `open(graphId)` | 498-551 | close previous, `new GraphCrdtSession(graphId)` (markRaw), `provider.connect(graphId, session)` for each sync provider, seed from legacy or `createGraph`, deref projection into the three trees, subscribe projection/history, `refresh()`, `loadAllScripts`, `orchestrator.createScheduler()` |
| `loadAllScripts(snapshot)` | 552-574 | collect `properties.scripts` from graph, nodes and nested `linkedGraph`s and inject them as `<script>` tags |
| `updateNodeTemplate(e)` | 575-579 | `node.template[type] = value`, commit "Update {type} value" (save-on-demand path of the code editor) |
| `updateNodeFields(e)` | 580-629 | deep-diff `observableDiff` of a node against the panel copy; applies input/output `name/external/type/visible` changes and rewrites edge fields / connector fields on rename; debounced 1000 ms commit "Rename IO" |
| `deleteNodeById(id)` | 630-647 | helper: strip connectors targeting the node, splice node (no commit) |
| `deleteConnectorById(id)` | 648-672 | helper (also inside `linkedGraph.graph`) (no commit) |
| `deleteSelected()` | 673-685 | clear selection state, delete nodes/connectors, commit "Delete" |
| `ungroupSelected()` / `groupSelected()` | 686-706 | edit `properties.groups`, commit "Ungroup"/"Group" |
| `duplicateSelection()` | 707-711 | `pasteNodes(deref(selectedNodes), "Duplicate")` |
| `updateNodeData(e)` | 712-716 | `node.data = e.data`, commit "Update Node Data" |
| `toggleSelectedNodePresentationMode()` | 717-723 | flip `appearsInPresentation`, commit |
| `createNewNode(e)` | 724-771 | new node at snapped position, commit "Create New Node" |

Other store modules [read]:
- `connectors.ts`: `removeInput` 3-27 (note the typo `this.this.orchestratorStore` at line 9 — would throw if reached), `removeOutput` 28-41, `addInput` 42-60, `addOutput` 61-83, `deleteConnector` 84-95, `selectConnector` 96-104 (selection only, shift/ctrl multi-select), `changeConnectorOrder` 106-118, `changeInputOrder` 119-136, `changeOutputOrder` 137-158 (moves matching edge too).
- `movement.ts`: `nudge` 4-14 (arrow keys; 2000 ms debounced commit "Nudge"), `nudgeUp/Down/Left/Right` 15-26, `setSelRelPropZ` 27-35, `bringForward`/`sendBackward` 36-41, `bringToFront` 42-51, `sendToBack` 52-61.
- `clipboard.ts`: `unzip` 4-24, `drop` 25-83 (files → `addDroppedItem`; `application/json+plastic-io` payload → `createNewNode` or `addItem`; plain JSON → `this.importItem(...)` which **does not exist anywhere** [grep]), `copyNodes` 84-102, `evCut/evCopy/evPaste` 103-142 (document-level listeners from `Workspace.vue:164-166`), `tryPasteNodeString` 143-165, `validateNode` 166-182, `pasteNodes` 183-224 (re-ids nodes/groups/connectors, sets `graphId`/`version`, commit "Paste").
- `live.ts`: `setNodePositions(positions, presentation)` 18-68 (writes snapshot first, then `crdtSession.transactLocal("Move Nodes", fn, "move-nodes")` setting only changed `x`/`y` on the Y maps), `endNodeDrag` 71-77 (`crdtSession.endLiveEdit()`).
- `text.ts`: `nodeTemplateText(nodeId, field)` 13-28, `graphTemplateText()` 31-38 (return attached `Y.Text` or null), `collaborationAwareness()` 41-44.
- `presence.ts`: `presenceProvider()` 11-18 (first sync provider with `setPresence`), `publishPresence(cursor, selection)` 21-30.
- `rewind.ts`: `rewindProvider` 21-34 (highest `historyPriority` with `history`+`updatesFor`), `listRewindHistory` 37-48, `projectRewind` 51-61, `previewRewind` 64-74, `commitRewind` 77-85, `exitRewind` 88-100.
- `info.ts`: `externalIO` 3-21, `selectNodes(ids)` 22-34, `raiseError(err)` 35-37 (**throws**), `isGraphTarget` 38-63, `getItemAt` 64-80, `getNodeById` 81-83.
- `viewport.ts`: `updateBoundingRect` 8-52, `scale` 53-79, `zoomOut/zoomIn/resetView/resetZoom/setView/zoom` 80-113.
- `state.ts` (6-100): selection/hover/drag state (`selectedNodes`, `selectedConnectors`, `hoveredConnector`, `hoveredNode`, `hoveredPort`, `addingConnector`, `movingConnector`, `movingNodes`, `translating`, `groupNodes`, `primaryGroup`), execution overlays (`activityConnectors`, `watchConnectors`, `errorConnectors`), history (`events`, `historyPosition`, `lastChangeName`), documents (`graph`, `graphSnapshot`, `graphSnapshotStore`, `crdtSession` held raw), flags (`graphLoaded`, `isNewGraph`, `inRewindMode`, `presentation`, `showGraphCodeEditor`, `locked`), `view {x,y,k}`, rects, MIME types (47-50), `ioTypes`, `tags`.

### C.2 `packages/Graph/crdt.ts` — `GraphCrdtSession` [read]

- Constructor (88-162): `new Y.Doc({guid: graphId})`; `new Y.UndoManager(doc.getMap(ROOT_KEY), {trackedOrigins: new Set([LocalOrigin]), captureTimeout: 3000})` (93-101); `stack-item-added` stamps `meta` with `description/time/id` for local origins, or copies them from `currStackItem` for undo/redo-created items (103-123); `trimUndoHistory` on every add (125); `stack-item-popped`/`stack-cleared` → `emitHistory` (126-127); `doc.on("updateV2")` fan-out to `updateListeners` (132-137); `afterTransaction` → if only `Y.Text` types changed, debounce projection 300 ms (`TEXT_PROJECTION_DEBOUNCE`, 23), else emit immediately (139-161).
- `seed(graph, source="seed")` (167-178): `fromJSON` inside a `RemoteOrigin(source)` transaction, so it is not undoable and is labelled "Start".
- Bounding: `MAX_UNDO_STEPS = 200` (35), `COLLECT_AFTER_DROPPED = 50` (41); `trimUndoHistory` splices the oldest entries off `undoManager.undoStack` (186-194); `collectDroppedHistory` walks each dropped item's `deletions`/`insertions` with `Y.iterateDeletedStructs`, clears the Yjs-internal `keep` flag up the parent chain, then runs `Y.tryGc` (208-239) — explicitly documented as relying on Yjs internals with failure contained.
- Writing: `commit(description, snapshot)` (273-278: `activeBatch = null; undoManager.stopCapturing(); reconcile(doc, snapshot, new LocalOrigin(description))`), `commitBatched` (285-288), `applyRemote(update, source)` (291-293 → `applyUpdate(doc, update, new RemoteOrigin(source))`), `transactLocal(description, fn, batchKey)` (296-301), `openBatch` (308-314: `stopCapturing` unless the same gesture is already open), `endLiveEdit` (321-324).
- History: `undo/redo` (328-334), `move(delta)` (337-346), `historyPosition = undoStack.length` (348-350), `historyEvents()` = undo stack + reversed redo stack, read from `stackItem.meta` (357-367).
- Events: `onProjection/onHistory/onUpdate` (371-384), `refresh()` (387-391), `emitProjection` builds `ProjectionInfo {local: origin instanceof LocalOrigin, fromUndo: origin === undoManager, origin}` (415-426).
- `projectUpdates(updates, count)` (439-448): replay merged updates into a throwaway `Y.Doc` and `toJSON` it (used by rewind).

### C.3 One edit end to end (double-click to create a node) [trace]

1. Gesture: `packages/workspace/components/Workspace.vue:168` registers `window.addEventListener('dblclick', this.dblclick)` → Input store `dblclick` (`packages/Input/store.ts:88-96`) → `this.graphStore.createNewNode({x, y})`.
2. Action: `mutation.ts:createNewNode` (724-771) pushes the node into `this.graphSnapshot.nodes` (769) and calls `this.updateGraphFromSnapshot('Create New Node')` (770).
3. Gateway: `updateGraphFromSnapshot` (423-439): returns if no session/snapshot; `current = crdtSession.projection()`; skips when `deepEqual(withoutVolatileFields(current), withoutVolatileFields(snapshot))` (`withoutVolatileFields` 22-29 zeroes `version` and drops `properties.lastUpdate`); sets `graphSnapshot.version = (current.version||0) + 1` (433), `properties.lastUpdate = Date.now()` (435), `lastChangeName` (437), then `crdtSession.commit(description, graphSnapshot)` (438).
4. Session: `crdt.ts:commit` (273-278) → `reconcile(doc, snapshot, new LocalOrigin("Create New Node"))`.
5. Reconcile: `reconcile.ts:reconcile` (479-547) → `doc.transact` → `reconcileNodes` (436-459) finds no Y.Map for the new id → `nodes.set(id, buildNode(node))` (454); root `version` scalar and `properties.lastUpdate` also change (506-514, 516-518).
6. Yjs transaction end → `doc.on("updateV2")` (crdt.ts:132-137) → every `onUpdate` listener:
   - `IndexedDBCrdtProvider` (`main.ts:50-57`) → `record(update, describeOrigin(origin))` (61-75) → coalesced 800 ms → `flushLog` (78-99) → `historyStore.appendUpdate` (`historyStore.ts:57-65`) into IndexedDB `plastic-io-crdt-history/updates`; y-indexeddb separately persists the V1 update into `plastic-io-graph-{id}`.
   - `WssCrdtProvider` (`main.ts:93-107`, only when a server is configured) → queue → `scheduleFlush` 150 ms (148-156) → `flush` merges (163-175) → `sendSync(writeUpdate(merged), "Create New Node")` (177-191) → `wss.send({action:"yjs", kind:"sync", graphId, payload: base64, description, format: 2})` → `WSSDataProvider.send` (`WssDocumentProvider/main.ts:91-97`) → `webSocket.send(JSON.stringify(e))`; payloads whose base64 exceeds `MAX_FRAME = 28000` (26) go `POST {graphHTTPServer}/crdt/{graphId}/update` with `{payload, description, format}` (193-207).
7. Same transaction → `afterTransaction` (crdt.ts:139-161) → `emitProjection` → store `applyProjection` (mutation.ts:445-457) → `patchInto` (`project.ts:97-105`, id-keyed in-place patch) of `graph` and `graphSnapshotStore.graph` (and `graphSnapshot` only for non-local origins) → `useGraphSnapshotStore().$subscribe` in `Orchestrator/main.ts:691-701` → 250 ms debounce → `pushGraphToWorker` (670-690) → `scheduleWorker.postMessage({method:'change', args:[graph]})` (686-689).
8. `UndoManager` `stack-item-added` (crdt.ts:103-123) → `emitHistory` → `session.onHistory` (mutation.ts:535-538) → `graphStore.events/historyPosition` → `HistoryPanel.vue` list (4-14) and the Top bar undo/redo enablement (`TopShortcutIcons.vue:24-31`).

Continuous drag variant [trace]: `Input/mouse.ts:409-428` computes snapped positions each mousemove and calls `graphStore.setNodePositions(positions, presentation)` → `live.ts:18-68` → `transactLocal("Move Nodes", …, "move-nodes")` (direct Y writes, one undo step via `openBatch`), and on mouse-up past the dead zone `mouse.ts:290-292` → `endNodeDrag` → `endLiveEdit`. Connector add/move goes through the snapshot: `mouse.ts:209` ("Move Connector") and `:270` ("Add Connector") → `applyGraphChanges` (33-35) → `updateGraphFromSnapshot`.

Code edit variant [trace]: `NodeEditor.vue:4-35` passes `:ytext="nodeTemplateText(nodeId, 'vue'|'set')"` and `:awareness`; `Editor.vue:bindToDocument` (264-280) creates the `MonacoBinding`, after which `update()` short-circuits (`dirty = false`, 501-507) and each keystroke is a Y.Text transaction whose origin is the binding (not a `LocalOrigin`) → **not undoable by the editor's undo manager** (only `LocalOrigin` is tracked, crdt.ts:96) and labelled "Edit Code" by `describeOrigin` (main.ts:107). The fallback `@save` → `saveTemplate` → `updateNodeTemplate` (NodeEditor.vue:121-128) is only used when no `ytext` is available.

### C.4 Undo/redo mechanics (summary)

Scope: the root `graph` Y.Map (crdt.ts:93); tracked origins `LocalOrigin` only (96); `captureTimeout` 3000 ms (100) but every `commit` calls `stopCapturing()` first (276), so a discrete action is always its own step and only `transactLocal` batches (drags) merge; bounded to 200 steps with GC release of dropped items (186-239); undo/redo of remote content is impossible by construction. Undo/redo transactions carry `origin === undoManager` → `local: false` → `applyProjection` patches the working snapshot as well (mutation.ts:447-453) so the next commit does not revert the undo. Triggers: `keys.ts:121-127` (Ctrl/Cmd+Z, Shift for redo), `TopShortcutIcons.vue:24-31`, `HistoryPanel.vue:9` (`moveHistoryPosition(-(historyPosition - index))`).

### C.5 Pending/unsynced state and failure handling — **absent** [grep + read]

- No unsynced/pending indicator exists. `orchestrator.pendingEvents` is read by `TopShortcutIcons.vue:126-128` (`pending` computed, not rendered in the template) but never written [grep: 3 hits, all reads]. `orchestrator.connectionState` (`Orchestrator/main.ts:153`) is never updated [grep: 0 hits outside the state declaration]. `WSSDataProvider.state` is internal and the `open/close/message` callbacks passed by the module are no-ops (`WssDocumentProvider/main.ts:21-23`).
- No acknowledgement or rejection path: `WssCrdtProvider.sendSync` (177-191) is fire-and-forget; `onMessage` (209-230) only handles `kind === "awareness"` or a sync payload (`SYNC_STEP1` → reply with diff; anything else → `applyRemote`). There is no message type for "rejected", no `messageId` on `yjs` envelopes, and the `origin` field of `YjsEnvelope` is never populated by the editor (183-190, 255-260). `postOverHttp` swallows failures with `console.error` (203-206); `loadInitialState` swallows with `console.warn` (141-143). `WSSDataProvider.get` is the only request that can reject (`e.err`, 260-266).
- Socket drop: `WSSDataProvider` reconnects on `close` while `keepOpen` (113-119), replays queued `messages` (106-108) and re-sends `subscribe` for each channel (109-111). `WssCrdtProvider` has no reconnect hook (the `open` callback is a no-op) so it does **not** re-run `SyncStep1` or `loadInitialState` after a reconnect; convergence then depends on the server sending `SYNC_STEP1` (220-228) or on the next page load.

---

## D. Collaboration providers

Two provider families hang off the orchestrator store [read `Orchestrator/main.ts:185-194`]: `syncProviders: any[]` (CRDT document transports, duck-typed `connect/disconnect/onUpdate-consumer/history/updatesFor/setPresence/remove`) and `dataProviders {artifact, toc, publish, notification, graph}` (legacy `DocumentProvider`-shaped services for TOC, artifacts, publishing, legacy graph fetch and the raw socket).

### D.1 `packages/WssCrdtProvider/main.ts` — server CRDT transport [read]

- Module (349-361): returns early when `preferences.useLocalStorage` is true; otherwise pushes `new WssCrdtProvider()` into `orchestrator.syncProviders`. `name = "wss"`, `historyPriority = 10` (49-51).
- `connect(graphId, session)` (68-110): skips in sandbox mode (72-75); takes the raw socket from `orchestrator.dataProviders.graph` (78) and `httpBase` from `preferences.graphHTTPServer` (79); warns and stays local if the socket has no `send` (80-83); `await loadInitialState(session)` (87); subscribes to channel `graph-crdt-{graphId}` (89-90); sends `SyncStep1(stateVector)` (91); attaches an `onUpdate` listener that skips updates whose origin `.source === "wss"`, batches by `describeOrigin(origin)` and flushes when the description changes (93-107); `startAwareness` (109).
- `loadInitialState` (120-144): `GET {httpBase}crdt/{graphId}/state?sv=<base64 stateVector>` expecting `{payload?, stateVector?}`; applies `payload` as `RemoteOrigin("wss")`; if the server returned its `stateVector`, computes `encodeState(doc, serverSV)` and, unless `isEmptyUpdate`, sends it as `writeUpdate` (offline edits pushed early).
- Outbound: `flush` (163-175) → `mergeUpdates(queue)` → `sendSync(payload, description)` (177-191) → `{action:"yjs", kind:"sync", graphId, payload, description, format: 2}` or `POST {httpBase}crdt/{graphId}/update` `{payload, description, format}` when base64 length > 28000 (193-207). `FLUSH_INTERVAL = 150` ms (24).
- Inbound `onMessage(response)` (209-230): drops messages without `payload` or with another `graphId`; `kind === "awareness"` → `applyAwarenessUpdate(awareness, bytes, "wss")`; `MESSAGE_SYNC_STEP1` → reply `SyncStep2(encodeState(doc, content))` if non-empty; else (`STEP2` or `UPDATE`) → `session.applyRemote(content, "wss")`.
- Awareness (`startAwareness` 234-278): `new Awareness(session.doc)`; local `user` = `{id: prefs.userId || prefs.workstationId || "anonymous", name: prefs.userName || "Anonymous", email, avatar, color: colorFor(String(doc.clientID))}` (237-247); `awareness.on("update")` sends `{action:"yjs", kind:"awareness", graphId, payload: base64(encodeAwarenessUpdate(awareness, changed))}` (248-261); `awareness.on("change")` rebuilds `orchestrator.graphUsers` and `orchestrator.graphUserMouse` (`{...cursor, user}`) excluding self (262-277). `setPresence(cursor, selection)` (281-289) sets `cursor` and `selection` local fields.
- Rewind: `history(graphId)` → `GET {httpBase}crdt/{graphId}/history` → cached array (293-300); `updatesFor(graphId, entry)` → `GET {httpBase}crdt/{graphId}/state/{id}` (id from `entry.id` or looked up by `entry.seq` in the cache) → `[fromBase64(data.payload)]` — a **single full-state payload**, not a prefix of the log (302-313).
- `remove(graphId)` → `{action:"deleteGraph", id}` (316-321). `disconnect` (323-346): clear timer, final `flush`, detach, `unsubscribe` the channel, destroy awareness.
- The `YjsEnvelope.origin` field is never populated by the editor; echo suppression relies on `RemoteOrigin.source === "wss"` (94) [read].

### D.2 `packages/IndexedDBCrdtProvider/{main,historyStore}.ts` — browser persistence + rewind log [read]

- Module always registers (`main.ts:138-143`). `name = "indexeddb"`, `historyPriority = 1` (31-33).
- `connect` (43-58): `new IndexeddbPersistence("plastic-io-graph-" + graphId, session.doc)`; `await persistence.whenSynced` (so the stored document is replayed before any listener is attached); `userId = preferences.userId || "local"` (49); `session.onUpdate` → `record(update, describeOrigin(origin))` unless `origin.source === "indexeddb"` (a source no code ever uses — `session.applyRemote(…, "indexeddb")` is never called; harmless) (50-57).
- `record` (61-75): opens/extends a pending entry per description; `LOG_COALESCE_MS = 800`, `LOG_MAX_BATCH = 200` (26-28). `flushLog` (78-99) writes `{graphId, time, description, userId, format: 2, update: mergeUpdates(pending)}` through a serialised `writeQueue` → `appendUpdate`.
- `history` (101-106) → `listHistory`; `updatesFor(graphId, {seq})` (109-113) → `updatesUpTo(graphId, seq, 2)`; `remove` (116-122) → `clearHistory` + `IndexeddbPersistence.clearData()`; `disconnect` (124-135).
- `historyStore.ts`: DB `plastic-io-crdt-history` v1, store `updates` with `keyPath: "seq", autoIncrement` and index `graphId` (11-13, 40-49); `HistoryRecord {seq, graphId, time, description, userId, format, update}` (15-24); `HistoryListing {seq, time, description, userId}` (26-31); `appendUpdate` (57-65); `readAll` sorted by seq (67-86); `listHistory` (89-97); `updatesUpTo` filters records with a different `format` (106-122); `clearHistory` (125-135).
- Addressing: history entries are addressed by the **autoincrement `seq`** locally; there is no `updateId`/ULID anywhere in the editor [grep `updateId|ulid`: no hits]. Server entries are addressed by whatever `id`/`seq` the `/crdt/{id}/history` response carries (D.1).

### D.3 `packages/WssDocumentProvider/{main,HTTPDataProvider}.ts` — raw socket + legacy data provider [read]

- Module (10-42): skipped when `useLocalStorage`; constructs `new WSSDataProvider(preferences.graphWSSServer, preferences.graphHTTPServer, noop, noop, noop)` (18-24) — throws if either URL is empty (64-69); assigns it to `dataProviders.graph`, `.publish`, `.artifact`, and wraps it as `.toc` with `get(tocKey) → getToc()` (29-40).
- `WSSDataProvider`: opens `new WebSocket(wssUrl)` in the constructor (84-85); `send(e)` queues while not open, else `webSocket.send(JSON.stringify(e))` (91-97); `connect` (98-124) handles `open` (flush queue, re-`subscribe` known channels), `close` (reconnect while `keepOpen`), `message` (`JSON.parse` → `messageHandler`).
- `messageHandler(e)` (130-165): reassembles chunked messages `{chunkCollectionId, parts, part, value}`; `e.unsubscribed` / `e.subscribed` maintain the subscription list; `e.messageId` resolves the pending promise with `e.response`; `e.channelId` fans `e.response` out to channel listeners; then the (no-op) module callback.
- Route helpers: `subscribe(channelId, listener)` → `{action:"subscribe", channelId}` (170-181); `unsubscribe` (182-195); `deploy({env, version, id})` → `{messageId, action:"deploy", env, version, id}` (196-208, **no caller** [grep]); `listSubscribers` (209-219), `listSubscriptions` (220-230), `sendToAll` (231-236), `sendToChannel` (237-243), `sendToConnection` (244-250) (**no callers** [grep]); `get(id)` → `{action:"getGraph", id, version:"latest", messageId}` rejecting on `e.err` (251-267); `delete(url, permanent)` → `{action:"deleteGraph", id, permanent}` (273-279); `restore(url)` → `{action:"undeleteGraph", id}` (281-286); `set(url, value)` (287-323): `"changes" in value` → `{action:"addEvent", event}` or HTTP `POST addEvent` when > `CHUNK_SIZE` 35000 (legacy deep-diff path; nothing calls `set` with `changes` any more [grep]); `"node" in value` → `{action:"publishNode", graphId, nodeId, version, messageId}` (no caller, see G.4); `"graph" in value` → `{action:"publishGraph", id, version, messageId}`.
- `getToc()` → `GET {httpUrl}toc.json` (125-129).
- `HTTPDataProvider` (HTTPDataProvider.ts): `set(url, body)` → `POST {baseUrl}{url}` and `get(url)` → `GET`, both with `Authorization: Bearer ${this.token}` (14-37); `token` is `""` and `setToken` is never called from anywhere [grep `setToken(`: definitions only].

### D.4 `packages/LocalStorageDocumentProvider/main.ts` — **dead code** [read + grep]

Not imported by `src/main.ts` (the plugin list at 73-119 does not include it; `git grep` finds no other importer). Internally it is the pre-CRDT event-sourced provider (`set` applies `deep-diff` changes to build state, 48-108; `subscribe` polls `localStorage` events, 124-167). Retained per its own comment "as a worked example" (31-33).

### D.5 `packages/IndexedDBDocumentProvider/{main,storageWorker}.ts` — local TOC/artifacts/legacy graphs [read]

- Module (16-37): registers only when `useLocalStorage` is true; creates two worker-backed providers, `type='update'` for `dataProviders.graph` and `type='artifact'` for `publish`/`toc`/`artifact` (20-35).
- `IndexedDBDataProvider` (42-138) proxies every method to `storageWorker.ts` via `postMessage({id, method, args})` with `flatted` (91-101); relays `toc-update` on a `BroadcastChannel("plastic-io-document-provider")` (44, 53-59) which `GraphManager.vue:90-98` listens to for list refresh.
- `storageWorker.ts`: IndexedDB `plastic-io-document-provider` v1 with stores `events` (keyPath id, index documentId) and `documents` (keyPath id) (4-16); `set(url, value, type)`: `'update'` appends a legacy event, `'artifact'` stores `value.graph` under id `${id}.${version}` in `documents` and updates the TOC with `type: 'publishedGraph'` (64-85, 158-189); `get(url, type)`: `toc.json` → `getToc`, `'artifact'` → `documents[url]`, else project legacy deep-diff events (`projectGraphEvents`, 190-216); soft delete via a `deleted` index document (104-137, 217-228); `getToc` hides deleted ids (139-152).

### D.6 `packages/DocumentProvider/main.ts` [read]

Abstract `DocumentProvider` (34-56: `updateToc, subscribe, get, getEvents, set, delete(url, permanent?), restore?`) and abstract `PreferencesProvider` (29-32) plus the interfaces quoted in B.1. Only IndexedDBDocumentProvider and the dead LocalStorage provider extend it; `WSSDataProvider` does not (structural duck typing).

### D.7 `packages/PreferencesProvider`, `LocalUserPreferences`, `ProviderSettings` [read]

- `UserPreferences` defaults (`PreferencesProvider/main.ts:83-111`): random `userName`, `email ""`, `userId '0'`, avatar URL from a dead service (87), `workstationId = newId()`, `useLocalStorage = true` (95), `graphWSSServer = ""`, `graphHTTPServer = ""` (102-103), `remoteConfiguration = "https://unpkg.com/@plastic-io/registry/package.json"` (108), `registries ''`, `componentScripts ''`, appearance defaults, default new-node `set`/`vue` templates and graph presentation template (5-47).
- `LocalUserPreferences` (main.ts): loads `localStorage["plastic-user-preferences"]` or defaults (61-65), persists every store mutation back (36-40), and **fetches `remoteConfiguration` and patches every key of its `appConfig` into preferences** (42-58) — so the remote registry manifest can override `useLocalStorage`, server URLs, `auth0`, etc. (What that URL currently returns was not fetched in this survey.)
- `ProviderSettings.vue` (10-36): switch "Local Storage / Server Storage" bound to `preferences.useLocalStorage`, HTTPS/WSS server fields (disabled in local mode), and `preferences.auth0.domain/clientId` (the `auth0` object is not a `UserPreferences` field; `Auth0SettingsPanel.vue:48-53` creates it lazily, and `ProviderSettings.vue:28-35` would throw on a fresh profile where it is undefined — not verified at runtime).
- `GraphManager.vue:116-123` shows "Refresh the page for settings changes to take effect" on any preference change; provider modules read `useLocalStorage` only in their constructors.

### D.8 Which provider is active in the public build [trace]

`.env` supplies nothing (A.3) and `useLocalStorage` defaults to `true`, so on the GitHub Pages build: `WssDocumentProvider` and `WssCrdtProvider` modules return early (`WssDocumentProvider/main.ts:15-17`, `WssCrdtProvider/main.ts:355-358`), `IndexedDBDocumentProvider` registers TOC/publish/artifact/legacy-graph providers, and `IndexedDBCrdtProvider` is the only sync provider. Every graph is therefore local-only unless the user flips the Provider Settings switch (or the remote `appConfig` overrides it). With a server configured, the sync providers are `[IndexedDBCrdtProvider, WssCrdtProvider]` in that order (plugin order in `src/main.ts:101-116` → connect order in `mutation.ts:508-514`), so IndexedDB replays before the socket attaches.

### D.9 Presence surfaces [read]

`Input/mouse.ts:431-440` publishes `{x, y}` in graph coordinates plus `{nodes, connectors}` selection ids every 100 ms (`PRESENCE_INTERVAL`, 14). `SharedMouse.vue:38-55` renders `orchestrator.graphUserMouse` as coloured cursors transformed by the local view; `SharedUsers.vue:22-38` renders `orchestrator.graphUsers` avatars/initials in the top bar. Remote **selection** is published (WssCrdtProvider 287) but no component reads it [grep `selection` in `.vue`: none].

### D.10 Every WebSocket route name and HTTP path the editor emits [grep `action:` / `fetch(`]

| kind | route / path | payload | sender |
|---|---|---|---|
| WS | `yjs` (kind `sync`) | `{action, kind:"sync", graphId, payload, description, format:2}` | `WssCrdtProvider/main.ts:183-190` |
| WS | `yjs` (kind `awareness`) | `{action, kind:"awareness", graphId, payload}` | `WssCrdtProvider/main.ts:255-260` |
| WS | `subscribe` / `unsubscribe` | `{action, channelId}` — channels used: `graph-crdt-{graphId}` (`WssCrdtProvider:90`), `graph-notify-{graphId}` (`Orchestrator/main.ts:653`) | `WssDocumentProvider/main.ts:177-180, 191-194` |
| WS | `getGraph` | `{action, id, version:"latest", messageId}` | `WssDocumentProvider/main.ts:253-259` (via `loadLegacyGraph`, `mutation.ts:492`) |
| WS | `deleteGraph` | `{action, id, permanent}` / `{action, id}` | `WssDocumentProvider/main.ts:274-278`; `WssCrdtProvider/main.ts:320` |
| WS | `undeleteGraph` | `{action, id}` | `WssDocumentProvider/main.ts:282-285` |
| WS | `publishGraph` | `{action, id, version, messageId}` | `WssDocumentProvider/main.ts:316-321` (from `Orchestrator/main.ts:296-299`) |
| WS | `publishNode` | `{action, graphId, nodeId, version, messageId}` | `WssDocumentProvider/main.ts:308-313` — **unreachable** (no caller) |
| WS | `addEvent` | `{action, event}` | `WssDocumentProvider/main.ts:303-306` — legacy, **unreachable** |
| WS | `executeGraph` | `{action, graphUrl, nodeUrl, value, field:'impulse'}` | `Node/NodeComponent.vue:64-71` (`onImpulseServer`) |
| WS | `panic` | `{action, graphId}` | `Orchestrator/main.ts:228-231` |
| WS | `deploy`, `listSubscribers`, `listSubscriptions`, `sendToAll`, `sendToChannel`, `sendToConnection` | see D.3 | defined, **no callers** |
| HTTP GET | `{graphHTTPServer}/crdt/{graphId}/state?sv=…` | → `{payload, stateVector}` | `WssCrdtProvider/main.ts:126-128` |
| HTTP POST | `{graphHTTPServer}/crdt/{graphId}/update` | `{payload, description, format}` | `WssCrdtProvider/main.ts:199-203` |
| HTTP GET | `{graphHTTPServer}/crdt/{graphId}/history` | → array of `{id?, seq, time, description, userId…}` | `WssCrdtProvider/main.ts:297` |
| HTTP GET | `{graphHTTPServer}/crdt/{graphId}/state/{id}` | → `{payload}` | `WssCrdtProvider/main.ts:310` |
| HTTP GET | `{graphHTTPServer}/toc.json` | TOC | `WssDocumentProvider/main.ts:126` |
| HTTP GET | `{graphHTTPServer}{artifact-url}` | published artifact JSON | `Graph/mutation.ts:55-56` |
| HTTP POST/GET | `{graphHTTPServer}/addEvent` etc. via `HTTPDataProvider` | Bearer token (always empty) | `HTTPDataProvider.ts:14-37`, only `set("addEvent")` at `WssDocumentProvider/main.ts:293` (legacy) |
| HTTP GET | arbitrary registry URLs (`preferences.registries`), `api.github.com/repos/…/contents/…`, item `url`s, `remoteConfiguration` | registry JSON | `Orchestrator/main.ts:312`, `GitHubProvider/store.ts:10`, `Graph/mutation.ts:68,73`, `Node/Node.vue:298,302`, `LocalUserPreferences/main.ts:45` |

---

## E. Identity and authorization in the editor

- `packages/AuthenticationProvider/main.ts` [read]: abstract `AuthenticationProvider {client; redirectCallback(); getUser(); getToken(); login(); logoff()}` (4-12); store `authentication` with `init: () => {}` and `identity {isAuthenticated:false, user:{}, provider:'', token:''}` (14-24); `login/logoff` delegate to `orchestrator.authProvider` (25-32).
- `packages/Auth0AuthenticationProvider/main.ts` [read]: registers the settings panel and two logoff/login icon plugins (15-66) and sets `orchestrator.authProvider` (69). `Auth0AuthenticationProvider` reads `preferences.auth0 {domain, clientId, redirect_uri?}` (93-105); warns and stops if missing (95-98); `init()` (111-150) → `createAuth0Client({domain, clientId, redirect_uri})`, handles the `/auth-callback` redirect and returns to the URL saved in `localStorage["auth0-redirect"]` (125-129), returns early if not authenticated (133-136), otherwise `getTokenSilently()` + `getUser()` → `authenticationStore.identity = {user, token, provider:'Auth0', isAuthenticated}` (138-149). `logoff` hard-codes `returnTo: 'http://localhost:8080/graph-editor/'` (185-189).
- Router guard: `Orchestrator/main.ts:89-99` runs `authenticationStore.init()` before every navigation and then `next()` unconditionally — **authentication is optional; nothing is gated** [read]. (Commit `3e2a2f6 "…made auth optional"` in `git log` is consistent.)
- Where identity is attached to requests: **nowhere**. `identity.token` is never read [grep `identity.token|\.token\b`: only `WssDocumentProvider/main.ts:88` and `HTTPDataProvider.ts:12,17,32`, i.e. the provider's own always-empty `token`]; `setToken` is never called; WS envelopes (`WssCrdtProvider:183-190, 255-260`, `WSSDataProvider.send`) carry no user/token field; the WebSocket URL is `preferences.graphWSSServer` verbatim (84) with no query token. The only identity that leaves the browser is the **self-declared** awareness `user` built from preferences (`userId` default `'0'`, `userName` random) (`WssCrdtProvider:237-247`), and the `userId` written into the local history log (`IndexedDBCrdtProvider:49`). `Auth0SettingsPanel.vue:5-27` merely displays `identity.user.email/picture`.
- Client-side permission concept: **absent**. `grep -rniE "permission|\brole\b|\bacl\b|\bowner\b|canEdit|readonly|readOnly"` over `src/` and `packages/` hits only TS `readonly` modifiers, IndexedDB `"readonly"` transaction modes, a Monaco marker owner string (`Editor.vue:444`) and an `<input readonly>` (`GraphRewind.vue:5`). The closest analogues are UI-only: `orchestrator.locked` toggled by `BottomShortcutIcons.vue:97` (disables shortcuts/mouse mutations: `keys.ts:35,62-65`, `mouse.ts:41`), `presentation` mode, and `controlsDisabled = !!node.artifact` which freezes IO editing on linked nodes (`NodeEdgePropertiesPanel.vue:227-229`, `ConnectorPropertiesPanel.vue:142-144`).

---

## F. Execution in the editor

### F.1 Scheduler instantiation: Web Worker [read]

- `packages/Orchestrator/main.ts:14` imports `SchedulerWorker from "./schedulerWorker?worker"` (Vite worker bundle). `createScheduler()` (475-702) is called at the end of `graphStore.open` (`mutation.ts:550`) and does `this.scheduleWorker = new SchedulerWorker()` (477).
- `packages/Orchestrator/schedulerWorker.ts` [read]: `rpc.init(e)` (38-59) pre-populates `workerObjProxy.nodes[nodeId][inputName] = undefined` for every node input (40-47), then `scheduler = new Scheduler(e.graph, e, workerObjProxy, logger)` (49) — `context` = the init message object, `state` = a deep `Proxy` whose every `set` posts `{source:'state-update', event:{path, value}}` to the main thread (17-26, `proxy.ts:2-17`), `logger` = a no-op object (30-36). Scheduler events forwarded with `flatted.toJSON`: `beginconnector, endconnector, set, afterSet, error, warning, begin, end` (51-58). `load` events resolve with `scheduler.graph` (13-15) — i.e. the loader never fetches artifacts. `onmessage` (69-95): `panic` → arm a throwing `beginedge` listener (61-68); `init`; `change` → `panic()` then `rpc.init` with the new graph (76-80, `// HACK: probably needs some sort of GC here`); any other `method` name is invoked on the scheduler instance (82-85) — the editor uses `url` (`main.ts:665-667`); otherwise a `{path, value}` state write (87-94).
- Main-thread side of the proxy: `mainObjProxy = createDeepProxy(this.webWorkerProxy, [], sendUpdateToWorker)` (479-482) is created but unused thereafter; `state-update` messages from the worker are written into `this.webWorkerProxy` by path (610-618). `orchestrator.scheduler.state` (201-204) is never written — the `:state="scheduler.state"` prop handed to node components (`Node.vue:43`) is a permanently empty object [grep `scheduler.state`: that one read].

### F.2 `graphSnapshotStore` subscription [read]

`Orchestrator/main.ts:668-701`: `useGraphSnapshotStore().$subscribe` → 250 ms trailing debounce (`SCHEDULER_PUSH_DEBOUNCE`, 23) → `pushGraphToWorker(state.graph)`: computes `schedulerRelevantShape` (34-62: id, url, properties minus `lastUpdate/lastUpdatedBy`, and per node `id,url,graphId,artifact,data,linkedGraph,linkedNode,edges,template,properties.{inputs,outputs,scripts}`), skips if `deepEqual` to the last pushed shape (layout-only changes never reach the worker), otherwise derefs, `loadAndIntegrateLinkedGraphsWithFields` (flattens nested graphs, 396-460), and posts `{method:'change', args:[graph]}` — which the worker answers by panicking and re-instantiating the scheduler (F.1). Initial `init` uses the same integration (592-608).

### F.3 How node code is compiled and executed in the browser

Two kinds of code per node:

**(a) `template.set` — runs inside the worker's scheduler.** Call site in the consumed bundle: `node_modules/@plastic-io/plastic-io/dist/Node.js:parseAndRun` (44-94) [read]: parses with `meriyah` (50-55), regenerates with `escodegen`, and builds
`new AsyncFunction("scheduler","graph","cache","node","field","state","value","edges","data","properties","require", code)` (61), dispatches `set` (62-73), then calls it with `this = nodeInterface.context` and the corresponding `NodeInterface` members plus `require = (path) => eval("require")(path)` (75-77; in the Vite worker bundle there is no `require`, so any node calling it would throw — not verified at runtime). Entry: `Scheduler.prototype.url(url, value, field, currentNode)` (`dist/Scheduler.js:107-169`) dispatches `begin`, picks `currentNode.linkedGraph.graph` or the root graph (120-125), finds the first node whose `url` matches `new RegExp(url)` (126-129), runs `Edge.execute` and dispatches `error`/`end`.
The default `set` template written by the editor is `if (edges.hasOwnProperty(field)) { edges[field] = value; } else { state.nodes[node.id][field] = value; }` (`PreferencesProvider/main.ts:5-9`) or, with new-node help on, `state.nodes[node.id][field] = value;` (`HelpOverlay/helpTopics.ts:732`, chosen at `mutation.ts:765`).

**(b) `template.vue` — compiled and mounted on the main thread.** `packages/CompileTemplate/main.ts:compileTemplate(hostComp, id, source, clearLoad)` (4-22) → `importVue.ts` (5-107): `@vue/compiler-sfc` `parse` → `compileTemplate` (whose `import {…} from "vue"` is regex-replaced with `const _x = self.dependencies.vue.x` aliases, 20-77) → `compileScript` → `compileStyle`; sets the global `self.dependencies = {vue}` (90-92); evaluates the script and render function by **dynamic `import()` of `data:application/Javascript;base64,…` URLs** (94-96, `stringToBase64Url` 109-116) and `vue.defineComponent(options)` (99). `vue3-sfc-loader` and `@babel/standalone` are **not used** (A.1). `packages/Node/Node.vue` calls it in `importRoot` (305-313), `importGraph` (314-322, compiles the linked graph's `properties.template`), `importNode` (323-337), and recompiles 600 ms after `node.template.vue` changes (152-171); compile errors → `raiseError(nodeId, err, 'vue')` and a "broken" card (29-34, 112-128). `packages/Node/NodeComponent.vue` (setup 22-90) renders the compiled component with `h({...props.component}, importedProps)` (74-77) and captures mount errors (79-85).

### F.4 Host bindings / ambient authority available to node code [read]

- Inside the worker (`set` code): the eleven named arguments above (`scheduler` — the whole scheduler instance, `graph`, `cache`, `node`, `field`, `state` — the shared cross-node proxy object, `value`, `edges`, `data`, `properties`, `require`), `this = context`, plus every Worker global (`fetch`, `WebSocket`, `importScripts`, `indexedDB`, `self`). No DOM.
- On the main thread (`vue` code) via `NodeComponent.vue:34-72` `importedProps`: `stores: {orchestratorStore, preferencesStore, inputStore, graphStore}` (**all Pinia stores, including every mutation action**), `transact(description, cb)` (41-45: mutate the node in the working snapshot and commit), `isHosted, hostNode, hostGraph, graph, node, scheduler, presentation, state`, the current input values (`...props.nodeProps`, sourced from `webWorkerProxy.nodes[nodeId]`, `Node.vue:234-236`), one `on<Output>` handler per output that calls `scheduler.instance.url(node.url, val, output.name, hostNode)` (26-33), `onData` (56-58 → `updateNodeData`), `onImpulse` (59-61), `onImpulseServer` (62-71 → WS `executeGraph`). Also globals: `window`/DOM, `window.OpenAI` (`src/main.ts:7-8`), `window.plastic_app` (65), `self.plastic {app, router, pinia}` (126-131), `self.dependencies.vue`, `JSZip`, and any script listed in `graph.properties.scripts`, `node.properties.scripts` (loaded into `<head>` by `loadScripts`, `Utils/main.ts:12-26`, from `mutation.ts:552-574` on open and `289-313` on drop) or `preferences.componentScripts` (`workspace/router.ts:6-10`).
- The default `set` template writes into the shared `state.nodes[node.id][field]` — node-to-UI data flow is a global mutable object, not an edge.

### F.5 How a graph's nodes are triggered [trace]

- Trigger primitive: `scheduler.url(nodeUrl, value, field, hostNode)` posted to the worker (`Orchestrator/main.ts:584-591, 665-667`). Editor call sites: `NodeComponent.vue:31` (output emits: `$emit('outputName', v)` from node templates), `:60` (`impulse`), `Node.vue:269` (`bindNodeEvents`, dead — `nodeEvents` is never bound), `Node.vue:287-289` (`@set` → field `"$url"`). The default help node template does `this.$emit("set", …)` (`helpTopics.ts:719-721`).
- The `url` concept: `node.url` (editable in `NodePropertiesPanel.vue:26-29` → `updateNodeUrl`) is matched by regex in `Scheduler.url`; `graph.url` (`GraphProperties.vue:10`, help text `helpTopics.ts:670-673` "sets what endpoint this graph controls") is only meaningful server-side (README 204-245 describes `<root>/<graph.url>.<node.url>`, README text only).
- "Entry"/"endpoint" UI: `packages/EndpointListPanel/EndpointListPanel.vue` is an **empty stub** (1-8) registered as `endpoint-list-panel` and never rendered [grep]. TOC keys `endpoint/{graphId}` exist server-side and are filtered out of the manager list (`GraphManager.vue:151, 167, 234`). Help topic `executeSelectedNode` ("preferences > test value", `helpTopics.ts:331-334`) refers to a UI that **does not exist** [grep `preferences.test|testValue`: none].

### F.6 How execution events are surfaced [read]

- Worker → `remoteEvent(name, args)` (`Orchestrator/main.ts:609-651`): `state-update` → `webWorkerProxy`; `error` → `raiseError(nodeId, {message}, 'set', field, graphId)` (619-624) → `orchestrator.errors[nodeId]` (379-383) → `NodeError.vue` alert (2-41, reads `errors[nodeId]`, Dismiss/Dismiss All → `clearError/clearErrors`) and the red badge in `NodeEditor.vue:52-57`; `beginconnector`/`endconnector` (when `preferences.showConnectorActivity`) append `{activityType:"start"|"end", key, event}` to `graphStore.activityConnectors[connectorId]` (514-583); with `preferences.debug` also `orchestrator.loading.connector[id]` and `orchestrator.log[]` — **no component reads `log`** [grep]. `begin` sets `startTime` (506-508); `set/afterSet/end/log/warning` handlers are effectively no-ops (486-513, 625-639); unknown event names are dispatched to an orchestrator action of the same name (646-650).
- Server → same dispatcher through the `graph-notify-{graphId}` channel (653-658), mapping `{eventType:'log', level:'error'}` to `error`.
- Edge animation/highlighting: `NodeEdgeConnector.vue` watches `activityConnectors` (250-271) → sets `activeConnector` (start) / clears it 150 ms after an end, shows the value popover (7-37, `.drop` class 28, 460-462) and redraws; `bezier.ts:31-46` picks the stroke colour with precedence hover > selected > errored > active > watched > default from `preferences.appearance.connectors.*StrokeStyle` (`Appearance/main.ts:57-78`). `errorConnectors` and `watchConnectors` are **never written** (only initialised in `Graph/state.ts:14-15` and `Orchestrator/main.ts:208-209`; readers at `NodeEdgeConnector.vue:169-177`, `bezier.ts:32`) [grep] — the error/watch edge colours are unreachable.
- `ConnectorInfo.vue` (mounted by `Workspace.vue:39` when `orchestrator.showConnectorView`, toggled at `BottomShortcutIcons.vue:45-52`) lists per-connector `start` activities for the hovered/selected connector with duration/typeof/value and copy (131-159).
- `EventLoggerPanel.vue` is an **empty stub** (1-8).

### F.7 Calling the server to execute

Only `onImpulseServer` (`NodeComponent.vue:62-71`) → `dataProviders.graph.send({action:'executeGraph', graphUrl, nodeUrl, value, field:'impulse'})`; results come back, if at all, as `graph-notify-{graphId}` events. `panic` sends `{action:'panic', graphId}` after halting the worker (`Orchestrator/main.ts:223-232`, top-bar icon `TopShortcutIcons.vue:18-22`). No HTTP execute path exists (D.10) [grep].

### F.8 The `openai` dependency

`src/main.ts:7-8` — `import OpenAI from 'openai'; (window as any).OpenAI = OpenAI;` — the only reference in the codebase [grep]. It exposes the OpenAI SDK as a browser global for node templates to call directly (ambient authority; no editor feature uses it).

---

## G. Nested graphs, components, publication, import, registry

### G.1 How a node references another graph or node [read]

- **Linked graph**: `mutation.ts:addGraphItem` (182-288) creates a node with `artifact: e.url || "artifacts/{id}.{version}"` (223), `url: <random name>` (224), and `linkedGraph: {id, version, data: {}, loaded: true, graph: <entire published graph JSON>, properties: {}, fields: {inputs, outputs}}` (226-237) where `fields.*[name] = {id: innerNodeId, field, type, visible, external:false}` for every inner IO marked `external` (189-215). The host node's own `properties.inputs/outputs` and `edges` mirror those fields (264-285). The embedded graph is stored in the Y doc as opaque JSON replaced whole (`schema.ts:82`, `codec.ts:115-118`), so a linked graph is a **frozen copy at import time**, not a live reference; `artifact` is a string label (`ImportPanelList`/registry items also carry `artifact` URLs).
- **Linked node**: `addNodeItem` (314-370) sets `linkedNode: e.item` (the published node JSON, `loaded: true` at 322), `artifact` (339), `url: e.url` (340), copies `data`, inputs/outputs, tags/icon and `template.set/vue` (341-366).
- **Component node**: `addComponentItem` (99-181) wraps a globally registered Vue component; inputs from `component.props`, outputs from `component.emits`, `set` = `edges[field] = value;` (144).
- Scheduler-side types `LinkedGraph`/`LinkedNode` (B.1) are what the worker consumes; `Orchestrator/main.ts:loadAndIntegrateLinkedGraphsWithFields` (396-460) rewrites connectors targeting the host node to the inner `fields.inputs[*].id`, pushes the inner nodes into the flat list with `graphId = rootGraph.id`, copies host output connectors onto the inner output edges, recurses, and finally renames `linkedGraph` → `loadedGraph` on the node handed to the worker (456-457).

### G.2 Rendering of linked nodes (`packages/Node/Node.vue`) [read]

`mounted` (212-237) branches: `linkedGraph` → `importGraph` (314-322: compiles `linkedGraph.graph.properties.template`, throws "Linked Graph template is blank" if absent); `linkedNode` → `importNode` (323-337: overwrites the imported node's `id`, `url`, `artifact` and positions with the host's, compiles its `template.vue`); else `importRoot`. `currentGraph` (362-364) passes `linkedGraph.graph` as `:graph` to `node-component` (39) so the graph presentation template's `<node v-for="node in graph.nodes" … :presentation="true">` (default template, `PreferencesProvider/main.ts:26-47`) renders the inner nodes with `hostNode` set, which hides their ports (`Node.vue:15, 58`) and positions them by `properties.presentation.*` (410-424). `NodePropertiesPanel.vue:10-17` shows "This node is linked from another graph." when `node.artifact` is set; IO/connector controls are disabled (`controlsDisabled`).

### G.3 Nested navigation / drill-down — **absent** [grep + read]

The router exposes only `/`, `/:documentId` and `/popout-editor/...` (A.2). No action, route or component opens a `linkedGraph` for editing; `packages/Graph/project.ts` is the in-place patch helper (B/C), not a project/navigation model. Editing a linked graph means re-importing a newer published version.

### G.4 Publication [trace]

- **Graph**: `GraphProperties.vue:65-70` "Publish Graph" → `orchestrator.publishGraph()` (`Orchestrator/main.ts:292-305`): shows the "Publishing" snackbar, `await dataProviders.publish.set(graph.id, {graph, id: newId()})`, "Published <name>", refreshes the TOC. Server mode: `WSSDataProvider.set` `"graph" in value` branch → `{action:"publishGraph", id: graph.id, version: graph.version, messageId}` (`WssDocumentProvider/main.ts:315-322`) — the editor sends **only id and version**; the server is expected to snapshot its own copy of that version. Local mode: `storageWorker.ts:74-81` stores the full graph under `documents["{id}.{version}"]` and adds a TOC entry `{type:'publishedGraph', id, url, version, name, description, icon, lastUpdate}` (158-189). No response is awaited in either mode.
- **Node**: `NodePropertiesPanel.vue:118-120` defines `publish() { this.publishNode(this.node.id) }` but `publishNode` exists in no store [grep] and the template (1-98) has no button calling `publish` — **node publishing is unreachable from the UI**. The `publishNode` WS route (`WssDocumentProvider/main.ts:307-314`) and the local `"node" in value` branch (`LocalStorageDocumentProvider` only) are dead. Help topic `nodePublish` (`helpTopics.ts:440-443`) still documents it.
- **Version semantics**: `graph.version` increments by one per committed change (`mutation.ts:433`) as a last-writer-wins scalar (`schema.ts:42-50`, so two concurrent committers can both write the same next number). Published artifacts are keyed `{id}.{version}`; nodes carry `version` = the graph version at creation/import/paste (`mutation.ts:149,221,299,337,736`; `clipboard.ts:198,214`) and connectors copy `node.version` (`mouse.ts:237,256`). There is no `artifactVersion` field [grep]. `TopShortcutIcons.vue:12-15` shows `v{{graph.version}}` on hover.

### G.5 Import (`packages/ImportPanel`, `packages/GitHubProvider`) [read]

- `ImportPanel/main.ts:14-23`: bottom-bar plugin (order 5). `ImportPanel.vue` tabs: **Local Graphs** (`ImportPanelList.vue`: TOC entries whose `type` matches `/published/`, grouped by the id prefix of `"{id}.{version}"` (64-80), newest first; each item is draggable with `dataTransfer.setData("application/json+plastic-io", JSON.stringify(item))` (54-57)), **Public Graphs** (`ImportPanelRegistry.vue`: `preferences.registries` CSV (136-138); `getPublicRegistry` at mount (84-89)), and any `library-registry-panel` plugin (none active). `ImportPanelComponent.vue` (lists `self.plastic.app._instance.appContext.components`, 22-26) is imported but **not placed in any tab** (`ImportPanel.vue:26-39`) — unreachable.
- **Registry format** as consumed by `Orchestrator/main.ts:getPublicRegistry` (306-344): a JSON document with `items[]`; an item of `type: "toc"` has an `artifact` URL (relative `./` resolved against the parent) that is fetched recursively; leaf items of type `publishedNode`/`publishedGraph` carry `id`, `version`, `name`, `description`, `icon`, `artifact` (relative resolved to `url`); results stored in `orchestrator.registry[url] = {parent, toc, url}`. Default registries preference is empty; `remoteConfiguration` points at `@plastic-io/registry` on unpkg (D.7). `GitHubProvider/store.ts:14-53` does the same walk via `api.github.com/repos/{repo}/contents/index.json` (base64 `content`), but the panel is not registered (`GitHubProvider/main.ts:23-24`) — dead.
- **Drop → node**: `clipboard.ts:drop` (25-83) → `addItem` (`mutation.ts:50-98`) resolves the payload in this order: `artifact-url` + `graphHTTPServer` → `fetch`; `type === 'publishedGraph'` → `dataProviders.publish.get(id)`; `type === 'component'`; `url` matching `api.github.com` → base64 content; any `url` → `fetch(url).json()`; else `publish.get("artifacts/{id}.{version}")`. Then `delete item.artifact; delete item.url` and dispatch by `type` to `addNodeItem` / `addGraphItem` / `addComponentItem` (91-96). Dropped `.json`/`.zip` files → `addDroppedItem` (a plain node copy with fresh id/url, connectors cleared, `properties.scripts` loaded).
- `artifacts/{id}.{version}` is the only artifact addressing scheme in the editor (`mutation.ts:51,80,223,339`; `LocalStorageDocumentProvider:14`; `IndexedDBDocumentProvider/main.ts:14`; scheduler defaults `artifacts/graph/{id}.{version}` and `artifacts/nodes/{id}.{version}` in `dist/Scheduler.js:69-70` are never exercised because the worker loader short-circuits, F.1).

### G.6 Presentation [read]

"Presentation" is a render mode, not a document: `graphStore.presentation` (`state.ts:80`) toggled by `BottomShortcutIcons.vue:103-110` or Alt+` (`keys.ts:59-61`), or forced by `graph.properties.startInPresentationMode` (`GraphCanvas.vue:236-238`). In this mode `GraphCanvas.vue:3-14` mounts the compiled `graph.properties.template` (`loadTemplate` 201-210, errors → `raiseError(graphId, err, 'vue')` and the `.graph-errors` alert 65-69) instead of the canvas, and `Node.vue:visible` (369-374) hides nodes lacking `appearsInPresentation`. The graph template is edited in Monaco via the "Graph Code" bottom-bar icon (`GraphCodeMenu.vue`, `GraphCanvas.vue:49-64`, bound to `graphTemplateText()`). `packages/Presentation/GraphPresentation.vue` and `packages/PresentationPanel/GraphPresentationPanel.vue` are **empty stubs** (1-8 each), registered but never rendered [grep].

---

## H. History, rewind, status surfaces, extension points

### H.1 HistoryPanel [read]

`HistoryPanel/main.ts:14-23` registers `history-panel-menu` (bottom bar, order 4). `HistoryPanel.vue` lists `[{description:"Start"}, ...events]` (75-83) from `graphStore.events`, highlights `historyPosition` (30-38), maps descriptions to icons (42-73), and on click calls `moveHistoryPosition(-(historyPosition - index))` (9) → `crdtSession.move` → repeated undo/redo. Per-user only (help text `helpTopics.ts:602-605`).

### H.2 Rewind (`packages/Rewind`, `packages/Graph/rewind.ts`, `IndexedDBCrdtProvider/historyStore.ts`) [trace]

- `Rewind/main.ts:14-24` registers `graph-rewind-icon` (bottom bar, order 3.5; comment 22-23 notes it was re-enabled by the CRDT migration). `GraphRewindIcon.vue:2-3` toggles `inRewindMode` and mounts `<graph-rewind>`.
- `GraphRewind.vue`: on mount `history = await listRewindHistory()` (78-85) → `rewind.ts:listRewindHistory` → `rewindProvider()` = the sync provider with the highest `historyPriority` exposing `history` + `updatesFor` (21-34; wss 10 beats indexeddb 1) → `provider.history(graphId)`. The transport counts **log entries** (`maxVersion = history.length`), not graph versions. `setVersion(n)` (164-174) → `previewRewind(history[n-1])` → `rewind.ts:projectRewind` (51-61) → `provider.updatesFor(graphId, entry)` → `projectUpdates(updates)` (`crdt.ts:439-448`) → `patchInto` the three trees without touching the Y doc (64-74). Record button → `commitRewind(entry)` (175-187) → `rewind.ts:77-85` → snapshot patched then `updateGraphFromSnapshot("Revert")` — an ordinary, undoable, mergeable edit. Eject → `exitRewind` (88-100) restores the live projection. Mouse mutations are refused during rewind (`mouse.ts:37-40`); `GraphCanvas.vue:109-118` bumps `graphUpdateVersion` to force re-render.
- Addressing: local = IndexedDB `seq` (D.2), fetched as the prefix `seq <= n` and merged; server = `history[]` entries with `seq` and `id`, fetched as one state blob from `/crdt/{graphId}/state/{id}` (D.1). No ULID/updateId in the editor.

### H.3 EventLoggerPanel, MiniMapInfo, HelpOverlay, SettingsPanel, WorkspaceControlPanel, ShortcutIcons [read]

- `EventLoggerPanel.vue`, `WorkspaceControlPanel.vue`, `ErrorInterstitial.vue` (rendered at `Workspace.vue:3`), `Input/InputInfo.vue`: empty stubs.
- `MiniMapInfo.vue` (mounted when `preferences.showMap`, `Workspace.vue:19`): draggable/resizable minimap drawing a rectangle per `graphSnapshot.nodes` and the viewport (33-38), zoom/pan controls.
- `HelpOverlay.vue`: scans the DOM for `help-topic` attributes (131-139) and shows `helpTopics[topic]`. Relevant topic titles (`helpTopics.ts`): "Node Set Function" (100-248, documents scoped variables `edges`, `state`, `field`, …), "Node Edges" (317-330), "Execute Selected Node" (331-334, describes a non-existent feature), "Log and State" (339-342), "History" (343-346), "Node URL" (416-419), "Publish" (440-443, node publish — unreachable), "Graph event source Version" (532-545, **stale**: describes deep-diff event sourcing), "Graph Publish Button" (558-561), "Rewind" (598-601), "History Panel" (602-605), "Graph URL" (670-673), "PANIC!" (6-9).
- `SettingsPanel/main.ts:13-20` (bottom bar, order 6) → `SettingsPanel.vue` renders every `settings-panel` plugin as an expansion panel with `v-model="preferences"` (2-9): General/Defaults/Canvas/Connector/Graph appearance, Registries (`RegistrySettings.vue`: remote configuration URL, registries CSV, GitHub repos CSV, component scripts CSV), Authentication (Auth0 domain/client id).
- `ShortcutIcons`: top bar (`TopShortcutIcons.vue`): folder/home, graph name + version, `<shared-users/>` (17), PANIC (18-22), undo/redo (24-31), duplicate, group/ungroup, z-order, delete, help. Bottom bar (`BottomShortcutIcons.vue`): mouse/selection coordinates, node count, viewport, zoom, connector info toggle (`showConnectorView`, 45-52), connector activity toggle/clear (53-70), labels, grid, map, lock (95-102), presentation (103-110).

### H.4 Extension points for an "agent activity / proposal review / deployment status" panel

1. **Panel registration**: create `packages/<Name>/{package.json,main.ts,Panel.vue}` with `name: @plastic-io/graph-editor-vue3-<name>`, `main: ./main.ts` (all existing packages follow this, A.1), run `npm install` to symlink, and add the class to the `plugins` array in `src/main.ts:73-119` after `Orchestrator` and `LocalUserPreferences`. In the constructor: `app.component('<tag>', Panel)` and `useOrchestratorStore().addPlugin(new Plugin({name, component:'<tag>', type, order, helpTopic, divider, props}))` — exact pattern at `packages/HistoryPanel/main.ts:7-26`. Hosts: `type:'system-bar-bottom'`/`'system-bar-top'` render inside Vuetify system bars (`Workspace.vue:5-18, 26-37`) where existing panels wrap content in `<v-menu>` (`HistoryPanelMenu.vue`); `'settings-panel'` for configuration; `'manager-top-bar-*'` on the graph list page; `'library-registry-panel'` as an Import tab. Anything else (`nav-panel-*`) has no host today.
2. **Server → panel events**: `orchestrator.dataProviders.graph.subscribe('graph-notify-' + graphId, cb)` (`Orchestrator/main.ts:653-658`) already routes server events; `remoteEvent` falls through to `this[eventType](args)` for unknown names (646-650), so a server event `{eventType:'deploymentStatus', …}` would call an orchestrator action of that name if one is added. New channels can be opened with `WSSDataProvider.subscribe(channelId, listener)` (`WssDocumentProvider/main.ts:170-181`); request/response with `messageId` (`get`, 251-267) is the existing RPC shape.
3. **Sync-provider hook**: push an object into `orchestrator.syncProviders` (185-187) implementing `connect(graphId, session)`/`disconnect()`; it receives every document update through `session.onUpdate((update, origin) => …)` with `describeOrigin(origin)` labels, and can call `session.applyRemote`, `session.transactLocal`, `session.projection()`; optional `history/updatesFor/historyPriority` (rewind) and `setPresence` (presence) capabilities are discovered by duck typing (`rewind.ts:21-34`, `presence.ts:11-18`).
4. **Selection / highlight state to reuse**: graph store `selectedNodes`, `selectedNode`, `selectedConnectors`, `hoveredNode`, `hoveredConnector`, `hoveredPort` (`state.ts`), actions `selectNodes(ids)` (`info.ts:22-34`) and `selectConnector` (`connectors.ts:96-104`); node outline colours react to selection/hover (`Node.vue:392-433`); `activityConnectors[connectorId]` drives edge animation and value popovers (`NodeEdgeConnector.vue:250-271`), and `errorConnectors`/`watchConnectors` arrays are read by `bezier.ts:32-40` but currently never written — a proposal-review panel could populate them to colour edges; `orchestrator.redrawConnectorVersion` forces edge redraws; per-node messages via `raiseError/info/warning/debug` (`Orchestrator/main.ts:379-395`) surface in `NodeError.vue`/`NodeEditor.vue` badges; `orchestrator.showInfo/infoMessage` is the global snackbar (`Workspace.vue:42-44`); `orchestrator.graphUsers/graphUserMouse` give presence; awareness already carries a `selection` field (`WssCrdtProvider:287`) that nothing renders.
5. **Document access**: `graphStore.crdtSession` (raw `GraphCrdtSession`) exposes `doc`, `undoManager`, `historyEvents()`, `onProjection/onHistory/onUpdate`; `graphStore.graphSnapshot` is the mutable working copy and `updateGraphFromSnapshot(description)` / `transact(description, cb)` (`mutation.ts:412-439`) the way to propose and apply an edit as a named, undoable step.

---

## I. Tests actually run [run]

Environment: node v25.7.0, npm 11.10.1 (CI uses Node 18). Commands run from the repo root; cypress and `test:e2e:crdt` were **not** run.

`npm run test:crdt` (`vitest run --config vitest.packages.config.ts`) — **6 files, 61 tests, all passed**, 691 ms:
```
 ✓ packages/Graph/__tests__/project.spec.ts  (7 tests) 1ms
 ✓ packages/GraphCrdt/__tests__/codec.spec.ts  (9 tests) 14ms
 ✓ packages/GraphCrdt/__tests__/reconcile.spec.ts  (13 tests) 15ms
 ✓ packages/GraphCrdt/__tests__/updates.spec.ts  (10 tests) 35ms
   stdout: 120 node graph: V1 118608 bytes, V2 72525 bytes, saved 39%
 ✓ packages/GraphCrdt/__tests__/converge.spec.ts  (11 tests) 44ms
 ✓ packages/Graph/__tests__/crdt.spec.ts  (11 tests) 429ms
 Test Files  6 passed (6);  Tests  61 passed (61);  Duration  691ms
```

`npm run test:integration` (`vitest run --config vitest.integration.config.ts`) — **1 file, 16 tests, all passed**, 3.48 s (`packages/Graph/__integration__/store.spec.ts`, real Pinia stores with a `MemoryProvider` stand-in for persistence, `createScheduler` stubbed, `dataProviders.graph.get` faked — spec lines 12-90). Suite names: creates a new graph; imports a pre-CRDT graph; node creation reaches doc/graph/scheduler copy; undo/redo through the pipeline; history labels; delete drops connectors; remote edit survives next local save; no-op does not write; version bumps once per change; rewind & commit as ordinary edit; drag streams positions and undoes in one step; drag does not disturb another's node; code editor gets the shared text; two people typing keep both edits; releases previous graph on open; reopens from stored log (92-452).

`npm run type-check` (`vue-tsc --noEmit -p tsconfig.vitest.json --composite false`) — **fails, exit 2**, 4 errors, all `TS6504`:
```
error TS6504: File '.../packages/Auth0AuthenticationProvider/Auth0LogOffMenu.vue.js' is a JavaScript file. Did you mean to enable the 'allowJs' option?
error TS6504: File '.../packages/HelpOverlay/HelpOverlay.vue.js' is a JavaScript file. ...
error TS6504: File '.../packages/ProviderSettings/ProviderSettings.vue.js' is a JavaScript file. ...
error TS6504: File '.../packages/Rewind/GraphRewind.vue.js' is a JavaScript file. ...
  The file is in the program because: Matched by include pattern 'packages/**/*' in 'tsconfig.vitest.json'
```
Those `.vue.js` files do not exist on disk (`ls`: No such file) and are not tracked (`git ls-files | grep '\.vue\.js$'` empty); they are vue-tsc's virtual files for exactly the four SFCs whose `<script>` tag has no `lang` attribute [grep `<script`], and `tsconfig.app.json` has no `allowJs`. The run completed well inside the 3-minute cap (it was started in the background with a 180 s limit and finished before it). No other TypeScript diagnostics were reported; whether option-level TS6504 errors suppress semantic diagnostics in this vue-tsc/TS 4.7 setup was not verified, so this is not positive evidence that the rest of the code type-checks.

`npm run test:unit` (`vitest --root src/`) was not run: `src/` contains no test files (`tsconfig.app.json` excludes `src/**/__tests__/*`, none exist).

---

## J. Debt, contradictions, dead code

1. **Unused/legacy dependencies** [grep, A.1]: `vue3-sfc-loader`, `@babel/standalone`, `@babel/core`, `@babel/preset-env`, `@babel/preset-typescript`, `@babel/plugin-*`, `onigasm`, `jshashes`, `htmlparser2`, `domhandler`, `domutils`, `monaco-editor-core`, `escodegen`, `meriyah` (last two only used inside the scheduler bundle) have no import site. `deep-diff` is still imported in four files; live use is only `mutation.ts:updateNodeFields` (588-621) and the legacy projection in `storageWorker.ts:190-206`; `LocalUserPreferences/main.ts:3` imports it without using it.
2. **Dead modules/components**: `LocalStorageDocumentProvider` (not in `src/main.ts`), `GitHubProvider` (registration commented out, `main.ts:23-24`), `ImportPanelComponent.vue` (never placed), `EndpointListPanel`, `EventLoggerPanel`, `Presentation`, `PresentationPanel`, `WorkspaceControlPanel`, `ErrorInterstitial`, `Input/InputInfo.vue` (stubs), `Node/store.ts` (empty store), `NodeListPanel` and the `nav-panel-*` plugin types (no host), `GraphCrdt/schema.ts:NODE_PROPERTY_CONTAINERS` (exported, unused [grep]).
3. **Orchestrator state never written/read** [grep counts outside `Orchestrator/main.ts`]: `resyncRequired`, `eventQueue`, `connectionState`, `remoteEvents`, `remoteSnapshot`, `queuedEvent`, `mouseMovements`, `heartBeatInterval`, `graphUserChat`, `testOutput`, `ownEvents`, `fortunes`, `graphReferences`, `createdGraphId` (0 refs); `pendingEvents` read but never written; `scheduler.state` never written; `log` written only in debug and never read; `mainObjProxy` (479-482) created and unused; `webWorkerProxy` mutation in `Node.vue:120-125` overwrites the whole per-node map each loop iteration (keeps only the last input) and keys it by `this.nodeId`, which is not a prop or data field of `Node.vue` (the prop is `node`), so it writes `nodes[undefined]`.
4. **Actions referenced by components that do not exist** [grep of definitions]: `importItem` (`clipboard.ts:79`), `save` (`GraphProperties.vue:122`, `NodeListPanel.vue:30`), `selectNode` (`GraphProperties.vue:123`), `showInfoDialog` (`NodeListPanel.vue:25`), `download` (`ImportPanelList.vue:52`), `publishNode` (`NodePropertiesPanel.vue:119`), `zoomReset` (`BottomShortcutIcons.vue:186`); `BottomShortcutIcons.vue:196-209` maps `undo/redo/duplicateSelection/…` from the **orchestrator** store where they do not exist (unused there, so harmless); `Node.vue:246` maps `clearArtifact` from the graph store where it is absent (it lives on the orchestrator as a no-op, `Orchestrator/main.ts:351-353`).
5. **Bugs visible on read**: `connectors.ts:9` `this.this.orchestratorStore.raiseError` (TypeError if a missing node is removed); `info.ts:raiseError` throws the error instead of recording it while `mutation.ts:42` and `clipboard.ts:147` call it expecting a UI notice; `keys.ts:43-44` uses assignment `no.id = n.id` inside `find` predicates (always truthy, corrupts ids on Escape during a drag); `GraphCanvas.vue:240` adds a `resize` listener on `document` (never fires); `Auth0AuthenticationProvider/main.ts:187` hard-codes a localhost logout `returnTo`; `Auth0SettingsPanel.vue:49-52` initialises `auth0.client_id` while the provider reads `clientId` (93-95).
6. **Version skew**: `@plastic-io/plastic-io` is pinned to 2.0.3 and there is no vendored copy under `packages/` [grep for a second `Scheduler` implementation: none]. The editor's `Node`/`Graph` prop types are interfaces imported as values (B.1). `GraphCrdt/package.json` ships `.ts` sources with `main: ./main.ts`, so the server must compile TS from this package (per its description) — no build output exists.
7. **Stale documentation in code**: help topic `graphVersion` (`helpTopics.ts:532-545`) still explains deep-diff event sourcing; `executeSelectedNode` (331-334) and `nodePublish` (440-443) describe features that are not wired; `Orchestrator/main.ts:1` "This code file is in an experimental state".
8. **Type-check hygiene**: four SFCs with bare `<script>` break `vue-tsc` (I); nine SFCs use the non-standard `lang="typescript"` (`Editor.vue`, `Appearance/*.vue`, `ImportPanelComponent.vue`, `NodeEdgePropertiesPanel.vue`, `TopShortcutIcons.vue`, `BottomShortcutIcons.vue`, `Auth0SettingsPanel.vue`, `RegistrySettings.vue`) [grep]. CI runs no tests or type-check (A.3).
9. **CRDT/transport gaps**: no ack/reject/pending handling and no resync after socket reconnect (C.5); `graph.version` is LWW so concurrent commits can produce duplicate version numbers used as artifact keys (G.4); `WssCrdtProvider.updatesFor` depends on the server returning a whole state per history id (D.1); `IndexedDBCrdtProvider`'s `origin.source === "indexeddb"` guard can never match (D.2); `yjs`+`y-indexeddb` store V1 bytes while the app's own log/wire use V2 (`updates.ts:17-19`).
10. **"Edges are the only bindings" is violated in the browser** (F.4): node Vue code receives every Pinia store and a `transact` that rewrites the graph; `window.OpenAI`, `self.plastic` (app/router/pinia), `self.dependencies.vue`, `JSZip` and the full DOM/`fetch` are globals; `graph.properties.scripts`, `node.properties.scripts` and `preferences.componentScripts` load arbitrary remote scripts into the page (`Utils/main.ts:12-26` call sites in `mutation.ts:552-574, 308-310`, `workspace/router.ts:6-10`); `set` code receives the `scheduler`, `graph` and the shared mutable `state` object, and the default template writes node output into `state.nodes[node.id][field]` rather than an edge; node code is evaluated via `import()` of `data:` URLs (`importVue.ts:94-96`) and `new AsyncFunction` (`dist/Node.js:61`); `remoteConfiguration` (default unpkg) can rewrite preferences including server URLs (`LocalUserPreferences/main.ts:42-58`).
11. **Registry/import trust**: `addItem` fetches arbitrary URLs from dropped payloads (`mutation.ts:53-77`) and executes `properties.scripts` from dropped files (308-310).
12. **Misc**: `vite.config.ts:12-14` `rollupOptions` at the wrong level; `index.html` depends on unpkg/jsdelivr CDNs at runtime; `GraphManager.vue:131-132` navigates with `window.location = "/graph-editor/{id}"` (hard-coded base) rather than the router; the deprecated avatar service URL in `PreferencesProvider/main.ts:87`.

---

## K. Evidence ledger

| ID | claim | path:lines | symbol | verified by |
|---|---|---|---|---|
| GE-01 | Root manifest declares npm workspaces `packages/*`, pins `@plastic-io/plastic-io` 2.0.3, and lists yjs/y-protocols/y-indexeddb/y-monaco/openai/auth0/deep-diff | `package.json:4-64` | dependencies | read + `node -e` version check |
| GE-02 | `openai` is only used to expose `window.OpenAI` | `src/main.ts:7-8` | `OpenAI` | grep (single hit) |
| GE-03 | Plugins are instantiated in a fixed order and `Orchestrator` must be first | `src/main.ts:73-131` | `plugins`, `new _Plugin(...)` | read |
| GE-04 | Router starts with no routes; packages add `/`, `/:documentId`, `/popout-editor/...` | `src/router/index.ts:2-6`; `packages/Manager/main.ts:8-12`; `packages/workspace/router.ts:11-15`; `packages/CodeEditor/router.ts:51-55` | `createRouter`, `addRoute` | read |
| GE-05 | CI builds with Node 18 and deploys to GitHub Pages; no tests | `.github/workflows/main.yml:1-33` | workflow steps | read |
| GE-06 | `.env` VITE_* variables are never read | `.env:1-6`; `src/router/index.ts:3` | `import.meta.env` | grep (only `BASE_URL`) |
| GE-07 | Y document layout: root map `graph`, `nodes` map keyed by id, text fields as Y.Text, `meta.schemaVersion` | `packages/GraphCrdt/schema.ts:62-90`; `codec.ts:105-150, 173-200` | `ROOT_KEY`, `buildNode`, `fromJSON` | read |
| GE-08 | Node order derived from `createdOn` then `id`; edges ordered by outputs | `packages/GraphCrdt/codec.ts:244-270, 275-282, 314` | `readNode`, `compareNodes` | read; `codec.spec.ts:46-71` passed |
| GE-09 | `reconcile` converts a plain snapshot into granular ops inside one transaction tagged with the origin | `packages/GraphCrdt/reconcile.ts:479-547` | `reconcile` | read; `reconcile.spec.ts` 13 tests passed |
| GE-10 | Inputs/outputs reconciled by `name`, connectors by `id`, groups by prefix/suffix splice | `reconcile.ts:131-185, 267-276, 335-346, 96-124` | `reconcileKeyedMapArray`, `reconcileStringArray` | read |
| GE-11 | Update format is Yjs V2; event `updateV2` | `packages/GraphCrdt/updates.ts:23-35` | `UPDATE_FORMAT`, `applyUpdate` | read; `updates.spec.ts:20-45` passed |
| GE-12 | Wire sync messages: varUint type 0/1/2 + varUint8Array; channel `graph-crdt-{id}` | `packages/GraphCrdt/protocol.ts:13-49, 85-87` | `readSyncMessage`, `channelIdFor` | read |
| GE-13 | `YjsEnvelope` and `AwarenessState` shapes | `packages/GraphCrdt/schema.ts:93-123` | interfaces | read |
| GE-14 | Local/remote origin markers and history labelling | `packages/GraphCrdt/main.ts:57-108` | `LocalOrigin`, `RemoteOrigin`, `describeOrigin` | read |
| GE-15 | All mutation actions and their commit descriptions | `packages/Graph/mutation.ts:31-771` | table in C.1 | read |
| GE-16 | Single commit gateway: no-op check, version bump, `lastUpdate`, `crdtSession.commit` | `packages/Graph/mutation.ts:22-29, 423-439` | `updateGraphFromSnapshot`, `withoutVolatileFields` | read; `store.spec.ts:266-283` passed |
| GE-17 | Session: UndoManager on root map tracking only `LocalOrigin`, captureTimeout 3000, `stopCapturing` per commit | `packages/Graph/crdt.ts:93-101, 273-278` | `GraphCrdtSession` | read; `crdt.spec.ts` 11 tests passed |
| GE-18 | Undo history bounded to 200 with `keep`-flag release and `Y.tryGc` | `packages/Graph/crdt.ts:35-41, 186-239` | `trimUndoHistory`, `collectDroppedHistory` | read |
| GE-19 | Text-only transactions debounce projection 300 ms | `packages/Graph/crdt.ts:23, 139-161` | `afterTransaction` handler | read; `crdt.spec.ts:189-210` passed |
| GE-20 | Drag writes positions straight into Y maps as one batched undo step | `packages/Input/mouse.ts:409-428`; `packages/Graph/live.ts:18-77`; `crdt.ts:296-324` | `setNodePositions`, `transactLocal`, `openBatch` | trace; `store.spec.ts:316-366` passed |
| GE-21 | Double-click → `createNewNode` → commit → reconcile → updateV2 → providers → scheduler push | `Workspace.vue:168`; `Input/store.ts:88-96`; `mutation.ts:724-771, 423-439`; `crdt.ts:132-161`; `Orchestrator/main.ts:691-701` | see C.3 | trace |
| GE-22 | Code editors bind Monaco directly to Y.Text; those edits are not tracked by the editor's undo manager | `packages/Graph/text.ts:13-38`; `packages/CodeEditor/Editor.vue:264-280, 501-507`; `crdt.ts:96` | `MonacoBinding`, `trackedOrigins` | read + trace |
| GE-23 | No pending/unsynced indicator, no ack/rejection handling | `packages/WssCrdtProvider/main.ts:177-230`; `Orchestrator/main.ts:146-153`; `TopShortcutIcons.vue:126-128` | `sendSync`, `onMessage`, `pendingEvents`, `connectionState` | read + grep |
| GE-24 | Socket reconnect replays queued messages and re-subscribes, but the CRDT provider does not resync | `packages/WssDocumentProvider/main.ts:91-124`; `WssCrdtProvider/main.ts:68-110` (no reconnect hook) | `connect`, `send` | read |
| GE-25 | Wss provider initial load via HTTP state-vector exchange; large updates via HTTP POST | `packages/WssCrdtProvider/main.ts:120-144, 193-207` | `loadInitialState`, `postOverHttp` | read |
| GE-26 | Awareness user identity is self-declared from preferences | `packages/WssCrdtProvider/main.ts:234-247` | `startAwareness` | read |
| GE-27 | Server rewind fetches one full state per history id | `packages/WssCrdtProvider/main.ts:293-313` | `history`, `updatesFor` | read |
| GE-28 | Local rewind log: IndexedDB `plastic-io-crdt-history`, autoincrement `seq`, format check | `packages/IndexedDBCrdtProvider/historyStore.ts:11-49, 106-122`; `main.ts:26-28, 61-99` | `appendUpdate`, `updatesUpTo`, `record` | read |
| GE-29 | Public build defaults to local-only: `useLocalStorage=true`, Wss modules return early | `packages/PreferencesProvider/main.ts:95, 102-103`; `WssDocumentProvider/main.ts:15-17`; `WssCrdtProvider/main.ts:355-358`; `IndexedDBDocumentProvider/main.ts:25-27` | constructors | trace |
| GE-30 | Remote `appConfig` from `remoteConfiguration` overrides preferences | `packages/LocalUserPreferences/main.ts:42-58`; `PreferencesProvider/main.ts:108` | `LocalPreferencesProvider.init` | read |
| GE-31 | Complete list of WS actions and HTTP paths | see D.10 | — | grep `action:` / `fetch(` |
| GE-32 | `deploy`, `listSubscribers`, `sendTo*`, `publishNode`, `addEvent` routes have no callers | `packages/WssDocumentProvider/main.ts:196-250, 287-314` | methods | grep |
| GE-33 | Auth0 token is obtained but never attached to any request; auth is optional | `packages/Auth0AuthenticationProvider/main.ts:111-150`; `Orchestrator/main.ts:89-99`; `HTTPDataProvider.ts:11-37` | `init`, `beforeEach`, `setToken` | read + grep |
| GE-34 | No client-side permission/role/ACL concept | `src/`, `packages/` | — | grep (`permission|role|acl|owner|canEdit|readonly`) |
| GE-35 | Scheduler runs in a Web Worker; `state` is a deep proxy mirrored to the main thread | `packages/Orchestrator/main.ts:14, 477`; `schedulerWorker.ts:17-26, 49`; `proxy.ts:2-17` | `SchedulerWorker`, `createDeepProxy` | read |
| GE-36 | Graph changes are pushed to the worker only when scheduler-relevant fields change; the worker re-creates the scheduler | `packages/Orchestrator/main.ts:34-62, 668-701`; `schedulerWorker.ts:76-80` | `schedulerRelevantShape`, `pushGraphToWorker` | read |
| GE-37 | `set` code is compiled with `new AsyncFunction(scheduler, graph, cache, node, field, state, value, edges, data, properties, require)` | `node_modules/@plastic-io/plastic-io/dist/Node.js:44-94` | `parseAndRun` | read (consumed bundle) |
| GE-38 | `Scheduler.url` matches `node.url` by RegExp and dispatches begin/error/end | `node_modules/@plastic-io/plastic-io/dist/Scheduler.js:107-169` | `Scheduler.prototype.url` | read |
| GE-39 | Vue templates compiled with `@vue/compiler-sfc` and evaluated via `import()` of data: URLs; vue3-sfc-loader/babel unused | `packages/CompileTemplate/importVue.ts:5-107` | default export | read + grep |
| GE-40 | Node components receive all Pinia stores and a `transact` mutator | `packages/Node/NodeComponent.vue:34-72` | `importedProps` | read |
| GE-41 | Output emits and `impulse` call `scheduler.instance.url`; `impulseServer` sends WS `executeGraph` | `packages/Node/NodeComponent.vue:26-33, 59-71`; `Orchestrator/main.ts:665-667` | events | trace |
| GE-42 | Scripts from graph/node properties and preferences are injected as `<script>` tags | `packages/Utils/main.ts:12-26`; `mutation.ts:552-574, 308-310`; `workspace/router.ts:6-10` | `loadScripts` | read |
| GE-43 | Connector activity drives edge highlighting; error/watch colours unreachable | `Orchestrator/main.ts:514-583`; `NodeEdgeConnector.vue:250-271`; `bezier.ts:31-46`; `Graph/state.ts:14-15` | `beginconnector`, `activityConnectors`, `errorConnectors` | read + grep |
| GE-44 | Scheduler errors surface as per-node alerts | `Orchestrator/main.ts:619-624, 379-383`; `packages/Node/NodeError.vue:2-41` | `raiseError`, `errors` | read |
| GE-45 | EndpointListPanel, EventLoggerPanel, Presentation, PresentationPanel, WorkspaceControlPanel, ErrorInterstitial are empty stubs | respective `*.vue:1-8` | — | read + grep |
| GE-46 | Linked graph is an embedded frozen copy with IO field maps; linked node embeds the node | `packages/Graph/mutation.ts:182-288, 314-370`; `GraphCrdt/schema.ts:82` | `addGraphItem`, `addNodeItem`, `NODE_OPAQUE_FIELDS` | read |
| GE-47 | Linked graphs are flattened before the scheduler sees them | `packages/Orchestrator/main.ts:396-460` | `loadAndIntegrateLinkedGraphsWithFields` | read |
| GE-48 | No drill-down navigation into linked graphs | `src/router/index.ts`; `packages/*/router.ts`; `packages/Graph/project.ts` | routes | grep + read |
| GE-49 | Graph publish sends only `{id, version}` over WS or stores the full graph locally | `Orchestrator/main.ts:292-305`; `WssDocumentProvider/main.ts:315-322`; `storageWorker.ts:74-81, 158-189` | `publishGraph`, `set` | trace |
| GE-50 | Node publish is unreachable (`publishNode` undefined, no button) | `packages/NodePropertiesPanel/NodePropertiesPanel.vue:1-98, 118-120` | `publish` | read + grep |
| GE-51 | `graph.version` is a LWW counter bumped per commit; artifacts keyed `{id}.{version}`; no `artifactVersion` | `mutation.ts:433`; `schema.ts:42-50`; `mutation.ts:223, 339` | `version` | read + grep |
| GE-52 | Registry format and import resolution order | `Orchestrator/main.ts:306-344`; `mutation.ts:50-98`; `clipboard.ts:61-76` | `getPublicRegistry`, `addItem`, `drop` | read |
| GE-53 | GitHub registry panel is defined but not registered | `packages/GitHubProvider/main.ts:23-24` | commented `addPlugin` | read |
| GE-54 | Presentation is a render mode using the compiled graph template | `packages/Graph/GraphCanvas.vue:3-14, 201-210, 236-238`; `Node.vue:369-374` | `loadTemplate`, `visible` | read |
| GE-55 | Rewind replays a prefix (local) or a state blob (server) into a throwaway doc; commit is an ordinary edit | `packages/Graph/rewind.ts:21-100`; `crdt.ts:439-448`; `Rewind/GraphRewind.vue:78-187` | `projectRewind`, `commitRewind` | trace; `store.spec.ts:285-314` passed |
| GE-56 | Plugin types and their hosts | `EditorModule/main.ts:10-50`; `Workspace.vue:11-36`; `GraphManager.vue:10-17`; `SettingsPanel.vue:3-8`; `ImportPanel.vue:21-38` | `Plugin`, `getPluginsByType` | read + grep |
| GE-57 | Server events dispatch to orchestrator actions by name | `packages/Orchestrator/main.ts:646-658` | `remoteEvent` | read |
| GE-58 | `test:crdt` 61/61 and `test:integration` 16/16 pass | logs in scratchpad `discovery/test-crdt.log`, `test-integration.log` | — | run |
| GE-59 | `type-check` fails with 4×TS6504 on virtual `.vue.js` of bare `<script>` SFCs | `discovery/type-check.log`; `packages/{Rewind/GraphRewind,ProviderSettings/ProviderSettings,HelpOverlay/HelpOverlay,Auth0AuthenticationProvider/Auth0LogOffMenu}.vue` | `<script>` tags | run + grep |
| GE-60 | `LocalStorageDocumentProvider` is not loaded by the app | `src/main.ts:17-56, 73-119` | plugin list | read + grep |
| GE-61 | Actions referenced but undefined: `importItem`, `save`, `selectNode`, `showInfoDialog`, `download`, `publishNode`, `zoomReset` | `clipboard.ts:79`; `GraphProperties.vue:122-123`; `NodeListPanel.vue:25,30`; `ImportPanelList.vue:52`; `NodePropertiesPanel.vue:119`; `BottomShortcutIcons.vue:186` | — | grep for definitions (none) |
| GE-62 | Orchestrator dead state fields | `packages/Orchestrator/main.ts:134-153, 173-177` | state | grep (0 refs) |
| GE-63 | Unused declared dependencies | `package.json:26-58` | — | grep `from '<pkg>'` (no hits) |
| GE-64 | Stale help text about event sourcing | `packages/HelpOverlay/helpTopics.ts:532-545` | `graphVersion` | read |
| GE-65 | Selection is published on awareness but never rendered | `WssCrdtProvider/main.ts:287`; `SharedMouse.vue`, `SharedUsers.vue` | `setPresence` | read + grep |
