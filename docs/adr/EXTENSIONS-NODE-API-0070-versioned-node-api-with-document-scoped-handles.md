# ADR-EXTENSIONS-NODE-API-0070: Versioned node API with document-scoped handles

Date: 2026-11-12

## Status

Proposed

## Context

Custom node packs reach the editor through `window.app`, LiteGraph prototypes
and internal stores. Changing those internals can break a pack. V4 gives packs
one versioned module to import, whose contract can stay fixed while the editor
changes behind it, and handles that keep their identity when the editor
rebuilds graph objects.

A node id alone is ambiguous: another document uses the same ids, and an undo
can give a removed node's id to the next node added. A node object has the
opposite problem: undo, redo and a tab switch rebuild the graph as new objects
even when they restore the same node.

## Decision

### Import a version, not the editor's internals

```js
import { comfy } from '/comfy/api/v4.js'

const node = comfy.graph.node('12')
const title = node?.getTitle()
```

`comfy.graph` is the graph on screen at each call. A node handle belongs to the
graph and document it was taken from: opening a subgraph changes where
`comfy.graph.node()` looks, but does not retarget a handle already held. To
look in a particular graph, use `comfy.graph.root()` or
`comfy.graph.subgraphs()`.

1. The module path carries the major and minor version. A new major is a new
   module, `v<major>.js`, at minor zero (the `_0` is dropped). A new minor,
   which may break compatibility, is `v<major>_<minor>.js`. A patch keeps the
   import and only adds: no feature of an earlier version changes. A call
   that needs different inputs, results or behavior is added beside the old
   one as `<name>_v2()`. A bug fix is generally not a patch.
2. A pack checks for a patch with `comfy.isApiVersionAtLeast('v4.0.0')`, or
   reads the frozen `[major, minor, patch]` from `comfy.getApiVersion()`. The
   check takes exactly three numbers with an optional `v` and throws a
   `TypeError` for anything else, because a looser spelling compares
   differently from what its author meant. A pack that must also run on an
   editor without V4 detects it before importing (decision 7).
3. A new module does not move a pack to a new version. A pack keeps working
   on the module it imports until the host removes that module.
4. A new version starts as a copy of the previous contract and
   implementation, in its own folder `src/platform/nodeApi/v<version>` with
   its own published module, and the earlier folder is not edited to make
   room for it. Types keep plain names inside the version (`Comfy`,
   `NodeHandle` in that folder's `types.ts`) and are namespaced outside it
   (`v4.Comfy`). A name that must be global, such as the window slot and the
   Pinia store id, carries the version. `src/platform/nodeApi/shared` holds
   only what every version should get fixes in, such as the listener
   primitive and the handle caches.
5. Nothing gives a pack "the current API": there is no unversioned module,
   global or alias, and `src/types/index.ts` must not declare one. A `latest`
   import would bind a pack to whichever contract the host ships next.
6. The Python V4 API, proposed alongside this one, sets out the same
   numbering in its `comfy_api/version_list.py` and accepts the same version
   spellings.

### Publish before loading packs

7. `/comfy/api/v4.js` is a module outside the application bundle, so it
   cannot import the API. Its source is
   `src/platform/nodeApi/v4/publishedModule.ts`; `publishedNodeApiPlugin` in
   `build/plugins/` serves it at that URL in development and emits it there
   in a build. It exports the API the host puts in `window.comfy_v4`, a slot
   named for the version, and an import map entry in `index.html` resolves
   the module path under the configured base path. A browser test loads a
   pack that imports it and checks that the pack's hook runs
   (`browser_tests/tests/nodeApi/publishedV4Module.spec.ts`).
   - Each version's store (`useComfyApiStore` for v4) holds that version's one
     API. The host never reads the slot back and never calls a version's
     store: every host call goes through one dispatcher, `useNodeApiHost` in
     `src/platform/nodeApi/nodeApiHost.ts`, which hands it to every published
     version, oldest first. What a version gives the host is the
     `VersionHost` contract in `shared/versionHost.ts`, one member per call:
     publishing, readiness, the packs the backend verified
     (ADR-EXTENSIONS-NODE-API-0071), the document and restore calls of
     decision 10, the palette's `reapplyTypeColors`, and the calls later
     features add, each named in its ADR. Adding a version adds one entry to
     the dispatcher's list and edits no file of an earlier version and none of
     the host files that call the API.
   - A pack that must also run on an editor without this version checks
     `window.comfy_v4` and imports the module with `import()`. An editor that
     predates V4 serves no `/comfy/api/v4.js`, and a static `import` of a
     missing module fails the pack's whole module, legacy code included. The
     slot is published before any extension loads (decision 8), so the check
     works in a module body.
   - The slot is read-only, so assigning to it changes nothing (and throws in
     a module), but configurable, so tests can reset it. A pack that deletes
     or redefines it changes only what a module not yet evaluated exports; an
     existing import and the host's reference are unaffected. V4 does not
     sandbox packs: they can already wrap `app` and LiteGraph.
8. The host publishes the API before it imports extension modules, so a pack
   can use `comfy` in its module body. `onReady` fires once `app.setup()` has
   run and before the first workflow loads, as the legacy `setup` hook does.
   A listener registered after that runs on the next microtask, never inside
   the call that registers it; this is how a pack that
   [loads late](EXTENSION-LOADING-0048-late-custom-nodes-turn-on-after-the-editor-opens.md)
   hears it. A second ready signal of one startup changes nothing. The canvas
   publishes the API again each time it starts up (a return to the graph
   view mounts it again), and publishing resets readiness, so a listener
   registered while that startup loads extensions waits for its setup, not
   the earlier one's; so does one whose microtask comes after the next
   startup began. The graph is empty at `onReady`, and the first load
   retires any handle taken then.

### Keep a handle only as long as it names its entity

9. A handle is a frozen object carrying identity that reads its entity each
   time it is used. It exposes no host object. A value it returns is a
   frozen copy, and a property value is copied as the workflow would save
   it, under its own name, so a `toJSON` that reads its key gives what the
   workflow saves; a property behind a getter that throws reads as
   `undefined` and is reported once. Identity (`id`, `graphId`, `isDeleted`, `type`) is a property; a
   node's and a widget's live state is read through a method (`getTitle()`,
   `isPinned()`). The fields of slots, graph scopes and documents that V2
   exposed as properties (`slot.name`, `scope.name`, `graph.version`) stay
   properties, so about 380 stored reads keep their spelling; a read that
   copies or computes (`snapshot()`, `links()`) is a method. Reading never
   changes the node: `getBounds()` measures where the node is now, as the
   canvas draws it, and for a collapsed node under Vue nodes that has not
   yet been drawn it gives LiteGraph's default collapsed width.
10. A handle names one entity in one graph of one loaded document. It finds
    its graph by id under the root it came from, so it survives undo and
    redo, which rebuild the graph as new objects. Whether the host retires
    it depends on whether a load replaces the document or rebuilds it:

    | Event                                                                                                                                   | Handle behavior                                                                                                                                                                                         |
    | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | A load of another workflow, a switch to a tab whose graph is not live, or a reload of the open workflow (a language change, late nodes) | `endDocument(graph)` retires every handle when the host freezes the outgoing tracker, and `beginDocument()` again just before configure. Take fresh handles from the loaded document.                   |
    | A switch to an open tab whose graph is still live (#21571)                                                                              | `endDocument(graph)` and `beginDocument()` together when the switch freezes the outgoing tracker; nothing is configured. Take fresh handles from the tab shown.                                         |
    | Undo or redo from the change tracker's own queue (`restoreHistory`)                                                                     | A handle whose entity is still there keeps working. A node or group handle whose entity is gone reports `isDeleted`, and reads it again if a later restore brings it back, unless a restore retired it. |
    | Undo or redo across a load, and Reuse Parameters                                                                                        | A load: the tracker passes `restoreHistory: false` for those states.                                                                                                                                    |
    | An API-JSON or A1111 import, which builds the incoming document in a fresh graph or in the graph it clears                              | `endDocument(graph)` and `beginDocument()` together at the import's freeze, before the clear. Take fresh handles from the imported document.                                                            |
    | A node moved to another graph, as Convert to Subgraph moves it                                                                          | A different entity: the old handle reports `isDeleted`. Take a handle in the destination graph.                                                                                                         |
    | A slot rebuilt by undo or redo                                                                                                          | Slot handles name slot objects, so a restore that finds one gone retires it. Read `node.inputs` or `node.outputs` again.                                                                                |

    The host's `loadGraphData` makes the document calls in this order. Each
    open workflow has its own graph (#21571), so the load configures that
    workflow's graph, or a fresh one for a workflow not yet open, and the
    graph it froze is often another object:

    ```mermaid
    flowchart TB
        load["ComfyApp.loadGraphData"] --> freeze["beforeLoadNewGraph freezes the outgoing tracker"]
        freeze --> flag{"restoreHistory?"}
        flag -->|No| ended["endDocument(outgoing rootGraph)"]
        ended -->|"clean, validation, beforeConfigureGraph"| begin["beginDocument()"]
        begin --> replace["graph.configure()"]
        flag -->|Yes| aside["beforeHistoryRestore(graph, state)"]
        aside --> restore["graph.configure()"]
        restore -->|finally| retire["afterHistoryRestore()"]
    ```

    - The outgoing document ends at the freeze, several awaits before the
      configure. Until the next document begins, every handle taken is
      retired as it is made, so an edit through it returns `false` instead of
      changing a document that is no longer saved or tracked. That includes
      the empty graph a load with `clean: true` stages before its configure,
      which the configure discards: an edit there would report success and
      be lost. From `beginDocument()` until the load finishes, a handle taken
      in the graph as it was then is retired too. That includes a handle a
      removal hook takes while a `clean: false` configure removes the
      outgoing nodes: it would otherwise read the incoming node with the same
      id. The ended graph is told from
      the one the load configures by its id-counter state (`LGraph.state`),
      which every configure replaces, as the host's `isCurrentGraphLoad`
      check tells them apart. The load runs until the host marks the graph on
      screen loaded (`isGraphLoading` in `graphLoadState.ts`) or an import's
      capture suppression ends. API-JSON and A1111 imports build the incoming
      document in a fresh graph, or in the graph on screen when no workflow
      owns it, which they clear, so they call `endDocument(graph)` and
      `beginDocument()` together at the freeze, before either. A switch to a
      tab whose graph is still live does the same, since it configures
      nothing. A load
      replaced or failing after the freeze leaves the graph on screen with
      its handles retired. The host ends that phase: when a load or an
      import stops, finished, failed or replaced, it calls `loadEnded()`,
      and from then a fresh handle works. A lookup never ends it.
    - A restore sets the id counters (`state.lastNodeId`, `state.lastGroupId`)
      from the state it loads, so an undo to before a node was added rewinds
      the counter and the next node added takes that id. When the restore
      finishes, even if configure fails part way, `afterHistoryRestore()`
      retires for good each handle whose entity is gone and whose id the
      graph could give again: above its counter, or not a number the counter
      gives. A subgraph shares the root's counters, so a handle to a node in
      a subgraph the restore dropped is judged by the root's counter and
      comes back with the subgraph. Outside a restore the counter only grows.
      The saved workflow keeps the node counter (`last_node_id`) but not the
      group counter, so a restore sets the group counter from the groups it
      loads, and a handle to the newest group it removes is retired.
    - A restore runs node callbacks while it configures, and an `onAdded`
      that adds a node would take the id the rewound counter gives. So just
      before configure the host calls `beforeHistoryRestore(graph, state)`,
      which sets aside each cached node handle whose node `state` lacks:
      until the restore finishes it reads only the object it named, so a
      removal hook gets the pack's own handle and reads its node, and a
      lookup that finds another node under the id makes a new handle. A
      handle a removal hook takes for the first time, for a node `state`
      lacks, is set aside the same way: the outgoing graph is told from the
      cleared one by its id-counter state, as for `endDocument`.
      `afterHistoryRestore()` then puts back a set-aside handle whose node is
      still there, as when a listener cancels the configure, retires one
      whose id another node took or the counter could give again, and puts
      back the others.
    - The change tracker marks a load `restoreHistory` only for a state from
      its own undo or redo queue that rebuilds the open document. A state
      from elsewhere (the saved workflow of an earlier run that Reuse
      Parameters restores in Linear mode) can give a handle's id to another
      node, so it is a load. So is an undo or redo that steps across such a
      load, or across a load of another state into the same workflow
      (`isSameActiveWorkflowLoad` in `workflowService.ts`), which keeps the
      tracker and its history: `reset()` marks the states next to it. A load
      that puts back the state the tracker holds, as a return to an open tab
      does, leaves the history a rebuild of that document, so undo and redo
      across it stay restores.
    - A node that the user, a pack or a redo removed comes back under its
      handle on any later undo or redo that restores it, however many
      restores ran in between, in the root graph or a subgraph, unless one of
      them went back to before the node was added.
    - Three cases are not detected, because a node still has the handle's
      id: a node replaced in place under the same id, as node replacement and
      the agent do on purpose, whose handle then follows the new node; a node
      added before the change tracker captured the canvas and then replaced
      by a redo, which ends with
      [#23333](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23333);
      and a load that an extension marks `restoreHistory`, an option meant
      for the change tracker. The API does not defend against an extension
      that sets it, nor against one that lowers a graph's id counter
      (`last_node_id` is writable), as it does not defend against one that
      redefines the window slot. The random ids the agent's collaborative
      mode mints do not raise the counter, so a handle to such a node is
      usually above it and is retired when a restore finds the node gone.

11. There is one handle object per entity for as long as it stays valid,
    however a pack reaches it, so a handle is a stable `Map` or `WeakMap`
    key. For node, group, slot, widget and graph-scope handles
    `comfy.sameEntity(a, b)` and `a === b` agree; `sameEntity` answers
    `false` for `comfy.graph`, a document handle and any other value.
12. Once an entity is gone its handle still gives its identity and reports
    `isDeleted`. Every other read, a list included, returns `undefined`, and
    the types say so. A node an undo or redo restores is the same handle
    again, unless a restore retired it while it was gone (decision 10); a
    pack then takes a fresh one.

### Distinguish a bad call from a missing entity

13. A member given an argument it cannot use throws a `TypeError` naming the
    member, what it needs and what it received, before it reads or changes
    anything. A check that needs a live entity runs after the entity is
    found. A positional argument beyond those a member takes is ignored. A
    missing or deleted entity is an ordinary result, `undefined` or `false`,
    never a throw. Every member follows the same rules for what a pack
    passes:
    - An object argument (options, patch, definition, item) is a plain
      object whose prototype is `Object.prototype` or `null`; a list, a class
      instance or `Object.create(proto)` is refused (`v4/checkedFields.ts`).
      It is read once, as a snapshot of its own enumerable fields, so a
      getter is called once and an inherited or non-enumerable field is not
      read.
    - A field the member does not take is refused, `__proto__` included, so a
      misspelled field shows at the call. A member may list a field it
      accepts and ignores.
    - `undefined` means the field is absent unless the contract gives it a
      meaning: a cleared color restores the default, and a property set to
      `undefined` is deleted. `null` restores a default wherever `undefined`
      does.
    - A callback is checked once, when it is passed. A name used as a key of
      a host object (a type, a property, a color's type) is a non-empty
      string that is not an `Object.prototype` member (`isStoreKey`).
    - A value to be stored is one the workflow saves unchanged: text, a
      finite number, a boolean, `null`, or a plain object or list of those,
      at most 1000 deep. A cycle, a getter, a function, `undefined` inside an
      object, `NaN`, a `Date`, a `toJSON` (enumerable or not, as
      `JSON.stringify` calls either; its descriptor is read and the hook never
      called) and a class instance are refused,
      naming the path (`value.list[0]`). One walk checks and copies the value
      (`shared/savableValue.ts`), and the stored copy is not frozen. A
      property value already on a node that the workflow could not save,
      such as a circular or BigInt one, reads as `undefined`.
    - A refusal is one branded `TypeError` from `shared/invalidArgument.ts`:
      `<member> needs <what>, not <received>.`, where `<received>` names the
      kind (a list, a function, an instance of `Date`, `10n`) cut to 80
      characters, or `<member> can only be called <when>.` for a call outside
      its allowed lifetime. `isInvalidArgument` tests the brand. Each member
      reports the first problem it meets.
    - This is a narrow exception to the
      [error-handling guidance](../guidance/error-handling.md), which says
      never to throw across an extension-facing API because existing packs
      depend on existing calls not throwing. No pack depended on these calls
      before this API, and a wrong argument is a mistake in the pack's code
      that a placeholder result would hide.

14. Every listener the API calls goes through one primitive. Listeners run in
    registration order. One that throws is reported through `reportError`
    and stops neither the host nor another listener. A disposer removes only
    its own registration and is safe to call again. A listener added during
    a delivery waits for the next one.

## Open work in the host

- [ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
  defines a document as one editing session with a session uid, and says a
  graph reload is not a document transition. The uid does not exist yet, so
  this API cannot tell a reload of the open workflow from a load of another,
  and retires handles on both. When the uid lands it replaces the document
  counter here, and decision 10 no longer lists a reload as a load.
- Since [#21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571)
  each open workflow keeps its own `LGraph`, and a switch to a tab whose
  graph is live configures nothing, so that graph could carry a handle's
  document across the switch. The API still retires every handle on a switch:
  an edit takes its undo step from the active workflow's tracker (the
  `history` service), so an edit through a handle to a tab not shown would
  change a graph whose own tracker neither records it nor marks it modified.
  Keeping handles across a switch needs the edit core to use the tracker of
  the handle's own workflow, and then decision 10 drops the switch row.
- [#23333](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23333): undo
  reissues the id of a node it removed to the next node added, and
  [#23733](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23733) does
  the same for group ids, since the saved workflow has no group counter.
  `beforeHistoryRestore()` and `afterHistoryRestore()`, their host calls and
  the narrowing in decision 10 work around both, and are removed only when
  both are fixed: removing them when only #23333 is fixed would let a group
  handle read another group. `restoreHistory` stays, because it is also how
  the host tells a rebuild of the open document from a load of another.
- The published JSDoc does not describe the workaround as behavior:
  `isDeleted` on node, group and graph-scope handles says an undo or redo
  that brings the entity back may restore the handle or may retire it, and
  that a pack then takes a fresh one. Removing the workaround keeps that
  promise, so the patch that removes it modifies no documented feature
  (decision 1).
- Slot identity across undo and redo needs a slot id the saved workflow
  carries (ADR-EXTENSIONS-NODE-API-0073, decision 14).
- [#23332](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23332):
  `LGraphNode.measure()` without a canvas context resets a collapsed node's
  drawn width to 0. `getBounds` measures with a context, so it does not
  depend on the fix.

## Alternatives considered

- Put the version in the type name, such as `Comfy_v4`. It versions one name
  out of dozens, and interfaces are erased at runtime, so it protects nothing
  a JavaScript pack binds to. A TypeScript `namespace` adds nothing either:
  the module is already the namespace, and `import * as v4` gives the same
  spelling.
- An unversioned `window.comfy` or a "latest" module. Every pack that used it
  would break when the next version is published.
- Build the published module into the application bundle. Its chunk name
  changes per build, and it would need the application's singletons; the
  versioned slot is one line, and the module is emitted on its own at a fixed
  URL.
- Have the host find its side of the API through `window.comfy_v4`. A pack
  that wrapped the global, as packs wrap `app` today, would then stop handle
  retirement for every pack.
- Handles as proxies with a cache per access path. A listener registered
  through one path missed events delivered through another.
- Hold handles weakly and release each when no pack holds it. A pack that
  kept state in a `WeakMap` keyed by a handle lost it once it dropped the
  handle, so identity depended on garbage collection.
- Throw on a read of a deleted handle. Converted packs read handles
  defensively and rely on `undefined`.
- A separate load method for undo and redo instead of `restoreHistory`. It
  would repeat the load pipeline of about five hundred lines, and comparing
  graph ids cannot tell an undo from a reload of the same workflow.
  `restoreHistory` also keeps the sizes mounted Vue nodes measured (#23897).
- Keep node ids from being reissued after an undo, in core. That changes what
  undo does to the id counter, which this API does not own; it is filed as
  #23333, and the API retires the handles itself until it is settled.
- Retire every handle on undo and redo. A handle to a node the undo did not
  touch would die on every Ctrl+Z.
- Retire every handle whose entity a restore finds gone, which was the first
  rule. It is safe, but remove, undo, redo, undo gave the node a new handle
  even when its id stayed reserved, against decision 12.
- Keep every handle whose entity is gone and bring it back when an entity
  with its id returns. A node added after an undo rewinds the counter takes
  the removed node's id, and the old handle would read it.
- Make a node handle's identity its id and type. It catches reuse by a node
  of another type and hides the same-type case.
- Retire only the handles a restore removed, by recording the entities before
  it. The counter rule gives the same safety without walking the graph
  first; `beforeHistoryRestore` reads only the node ids of the state it is
  given.

## What this API replaces or duplicates, and why

- **Version parsing.** A strict regex in `apiVersion.ts`, not the `semver`
  package the app already depends on. `semver` accepts ranges, prerelease
  tags and loose spellings, and the Python API accepts exactly
  `v?(\d+)\.(\d+)\.(\d+)`.
- **Listeners.** `shared/listeners.ts`, not VueUse's `createEventHook`. That
  keeps listeners in a `Set`, so a function registered twice is one
  registration that either disposer removes; a listener that throws stops
  the delivery to the others; and it cannot deliver once and forget. Those
  three are the contract of decision 14.
- **A copy of a property value.** A JSON round trip, which is what
  `LiteGraph.cloneObject` does, but that function is deprecated and takes
  only an object; `structuredClone` throws on a function and keeps values
  the workflow would not save. The contract is a copy as the workflow would
  save it, which is what `serialize()` does with `JSON.stringify`. The deep
  freeze is new: nothing in the repository provides one.
- **Plain-object check.** `isPlainObject` from `es-toolkit`, already a
  dependency.
- **Geometry types.** `Point`, `Size` and `Bounds` are declared in
  `types.ts`, not taken from `shared-frontend-utils/geometry`, whose types
  have the same fields but are mutable and belong to the app; a contract
  that names an internal type changes when the app does.
- **Measuring a node.** `getBounds` measures with a private canvas context,
  so a collapsed node has the width the canvas will draw before any frame
  has drawn it, and a node moved since the last frame is where it is now. A
  subgraph that is not on screen has no app context to hand, and measuring
  sets the context's font. `measure()` writes the width it computes into the
  node, so the cached width is put back afterwards, as `pendingBounds` in
  `liveGraphApplier.ts` does; that function is in `workbench/`, which
  `platform/` may not import.
- **Whether an id can be given again.** Read from the graph's own id
  counters (`LGraph.state`), which `idAllocation.ts` mints from, rather than
  a record the API keeps of the ids it has seen: the counter decides the next
  id, and the same restore the API is told of sets it.
- **The document counter.** `beginDocument()` and `endDocument()` count
  loads because the session uid of ADR-GRAPH-DOCUMENT-0026 does not exist
  yet.
- **`restoreHistory`.** The option `loadGraphData` already takes for the
  change tracker's undo and redo, not a second load method (see
  "Alternatives considered").
- **The store.** `useComfyApiStore` holds the one API so the host reaches it
  without reading `window.comfy_v4` and a test can reset it.
- **The dispatcher.** `useNodeApiHost` fans each host call out to the
  versions it lists. The host had no seam for several versions; calling each
  version's store from each host file would make every new version an edit
  to `GraphCanvas.vue`, `app.ts`, `themeService.ts` and `extensionLoader.ts`.
  `ServedPack`, the backend's record of a verified pack, is in `shared/`,
  because every version takes it from the same host.
- **The published module.** Authored in TypeScript, so the module that
  exports the API is checked against the API's types. The build already
  emits importable modules for `window.comfyAPI`, but only in production
  builds; this module needs the same URL in development, so it has its own
  plugin rather than joining that one.

## Consequences

The API can change behind the handles and the root object without touching
packs, and a breaking change is a new folder and module rather than an edit.

The API is in the application bundle the host loads at startup. Measured
against `main`, it adds 113.4 KB minified (37.5 KB gzip) on its own, and the
full build grows by 225 KB raw (about 45 to 56 KB gzip, depending on
chunking): the API and the host modules it imports join the shared startup
chunk, which grows from 13.6 KB to 402 KB (4.0 to 104 KB gzip). Loading
`comfyApi.ts` with `import()` in `publish()` would take it off that path, but
`publish()` must still finish before extensions load, and about 13 host call
sites would need a no-op host until it resolves; that is left for a measured
follow-up.

Host changes outside the folder:

- `GraphCanvas.vue` publishes the API before extensions load and marks it
  ready as soon as setup finishes.
- `src/scripts/app.ts` calls `endDocument(graph)` with the outgoing root
  when it freezes the open document to load another, `beginDocument()`
  before configuring a saved document or, on the import paths, together with
  `endDocument`, and `beforeHistoryRestore(graph, state)` and
  `afterHistoryRestore()` around configuring an undo or redo into the
  workflow's own graph. `restoreHistory` gains a JSDoc saying
  extensions must not set it. An undo or redo keeps the node sizes of the
  state it restores: the load no longer grows each node to its content
  (`computeSize()`) as it does for a saved document. That state was taken
  from the live graph, so its sizes already fit the content; what a rebuilt
  node computes before a pack fits it again (a mounted widget whose height
  the pack sets from a `ResizeObserver`) is larger, and growing to it made
  the pack's fit a new undo step that emptied the redo queue.
- `workflowService.ts` calls `endDocument(graph)` and `beginDocument()`
  together when a switch to a tab whose graph is still live freezes the
  outgoing tracker, since that switch does not go through `loadGraphData`.
- `GraphCanvas.vue`, `src/scripts/app.ts`, `workflowService.ts`,
  `themeService.ts` and `extensionLoader.ts` make every call into the API
  through `useNodeApiHost()` (decision 7).
- `src/scripts/changeTracker.ts` sets `restoreHistory` only for a state from
  its own undo or redo queue, and remembers each state an undo or redo
  pushed across a load and each state next to a load of another state into
  the same workflow (`reset()`), so that restoring it is a load too
  (decision 10). At the end of a load it takes its workflow's graph as the
  `afterLoadGraph` hooks left it as the loaded state
  (`adoptLoadedGraph()`), so an edit such a hook makes, through a handle or
  not, is part of what the load gives, and the user's next undo does not take
  it back. A user edit made while a slow `async` hook awaits is absorbed the
  same way. After an undo or redo, until the user's next action (a pointer
  press, key press, wheel turn or drop), the next undo or redo, or one second
  after the restore (`RESTORE_SETTLING_MS`), whichever comes first, it takes a
  change into the restored state instead of recording it, so a pack reacting
  to the restore keeps redo (ADR-EXTENSIONS-NODE-API-0075 decision 13).

A graph's `configuring` event can cancel a load after `endDocument` and
`beginDocument()` have run. No core listener cancels. If an extension does,
the handles to the document that stays on screen are retired, and a pack
takes fresh ones.

Handles are kept until their document is replaced, so memory grows with the
number of entities packs have asked about in the open document, and is
released on the next load. An undo or redo releases the handles it retires.
A handle to a node that is gone but may come back is kept, as identity needs:
a pack may know it only as a `WeakMap` key. So memory and the walk each undo
makes follow every node packs have asked about in the document, deleted ones
included: with 10,000 nodes made and deleted, each with a node, a widget and
a slot handle taken, the handles hold 144 MB (14.4 KB a node) until the next
load, and each undo walks them in about 30 ms. A node handle with its members
is 9.6 KB, about 60 closures; shrinking it, not weakening the hold, is how to
lower this.

Adding a version adds wiring beside this one: an import map entry in
`index.html`, a `Window` entry in `src/types/index.ts`, an ignore entry in
`knip.config.ts`, its store in the list `useNodeApiHost` dispatches to, and
the name of its node-type extension in the extension store's list of
extensions that are always enabled (ADR-EXTENSIONS-NODE-API-0071). No host
file that calls the API changes. Each version is its own API, with its own
handle caches, so a v4 handle and a v5 handle to one node are two objects and
`sameEntity` of the two is `false`. A pack that moves to a new version one
file at a time compares the handles each file takes from one version.

`knip.config.ts` lists `publishedModule.ts` as an entry, because nothing in
the app imports it. Release and desktop packaging take `comfy/api/v4.js` from
the build output, not from `public/`. A pack
types the import through the published `v4` namespace and a declaration
mapped to `/comfy/api/v4.js` in its own `tsconfig.json`
(ADR-EXTENSIONS-NODE-API-0077, decision 3).

A pack that keeps a handle across a tab switch takes a fresh one when its
document is shown again, and a pack that keeps a handle to a node an undo
removed by going back to before the node was added takes a new one if redo
restores the node. For node types and hooks, see
[ADR-EXTENSIONS-NODE-API-0071](EXTENSIONS-NODE-API-0071-node-definitions-and-hooks.md);
for edits and persistence,
[ADR-EXTENSIONS-NODE-API-0073](EXTENSIONS-NODE-API-0073-functional-edit-core.md).
