# ADR-EXTENSIONS-NODE-API-0070: Versioned node API with document-scoped handles

Date: 2026-11-12

## Status

Proposed

## Context

Custom node packs reach the editor through `window.app`, LiteGraph prototypes,
and internal stores. Any change to those can break a pack, and a pack that
reads them cannot be kept working when they move. Packs need one supported
object to import, whose contract can be versioned and whose implementation the
editor can change freely.

Two things decide whether such an API can ever change without breaking packs:
what a pack binds to when it imports the API, and what a pack is holding when
it keeps a reference to a node.

Node ids do not identify a node on their own. Another document reuses the same
ids, and undo, redo, and tab switches rebuild a graph as new objects from saved
data. A reference that is an id alone can silently resolve to a different node;
a reference that is the node object dies on every undo.

## Decision

### The version lives in the container

1. A pack imports one module and stays bound to it:
   `import { comfy } from '/comfy/api/v4.js'`. API versions are numbered
   major.minor.patch.
   - Major: substantial differences from the major version before it. A new
     module, `v<major>.js`. The `_0` is dropped.
   - Minor: modest differences, some of them breaking. A new module,
     `v<major>_<minor>.js`.
   - Patch: additions only. No feature of an earlier version is modified and
     the import stays the same. A call that needs different inputs, results,
     or behavior may be added beside the old one as `<name>_v2()`. A bug fix
     is generally not a patch.
2. A pack checks for a patch with `comfy.isApiVersionAtLeast('v4.0.0')` or
   reads `[major, minor, patch]` from `comfy.getApiVersion()`. The check
   accepts exactly three numbers with an optional `v`, because a looser
   spelling compares differently from what its author meant.
3. A new module is a different API. It does not force a pack to change: a pack
   keeps working on the module it imports until that module is removed.
4. The version is never in a name inside the container. Each version's source
   has its own folder, `src/platform/nodeApi/v<version>`, and its own published
   module. `Comfy`, `NodeHandle`, and the other types are plain names in that
   folder's `types.ts`; outside the folder they are written `v4.Comfy`. A later
   version is added beside this one and this folder is not edited to make room
   for it. A new version starts as a copy of the previous one's contract and
   implementation, because the old version must stay exactly as it shipped.
   `src/platform/nodeApi/shared` holds only what every version should get
   fixes in, such as the listener primitive and the handle caches. A name that
   must be global, such as the window slot and the Pinia store id, carries the
   version.
5. Nothing gives a pack "the current API". There is no unversioned module,
   global, or alias. `src/types/index.ts` must not declare one.
6. The Python V4 API, proposed alongside this one, sets out the same numbering
   rules in its `comfy_api/version_list.py` and accepts the same version
   spellings.

### Publishing

7. `public/comfy/api/v4.js` is a static file outside the application bundle, so
   it cannot import the API. The host passes the API to it through
   `window.comfy_v4`, a slot named for the version. An import map entry in
   `index.html` resolves the module path under the configured base path.
   - The app has one API of each version, held by that version's store
     (`useComfyApiStore` for v4). The host never reads the slot back, and it
     never calls a version's store either: it calls one dispatcher,
     `useNodeApiHost` in `src/platform/nodeApi/nodeApiHost.ts`, which lists
     the published versions and hands each call to every one of them, oldest
     first. What a version gives the host is the `VersionHost` contract in
     `shared/versionHost.ts`, one member for each call the host makes into a
     version: publishing, readiness, the packs the backend verified
     (ADR-EXTENSIONS-NODE-API-0071), the document and restore calls
     (decision 10) and the palette's `reapplyTypeColors`. The ADR of each
     later feature names the calls it adds, and how the dispatcher combines
     what they return. So adding a version adds one entry to that list, and
     edits no file of an earlier version and none of the host files that call
     the API.
   - A pack that must also run on an editor without this version checks the
     slot and imports the module with `import()`: an editor that predates the
     version serves no `/comfy/api/v4.js`, and a static `import` of a module
     that is not there fails the pack's whole module, legacy code included.
     The slot is published before any extension loads (decision 8), so the
     check is right in a module body.
   - The slot is read-only: assigning to it changes nothing, and throws in a
     module. A pack that deletes or redefines it changes only what a module
     not yet imported will do: export the replacement, or throw an error that
     says the API is missing. The slot stays configurable so tests can reset
     it. The API does not defend against a pack that redefines it before
     another pack imports it: packs can already wrap `app` and LiteGraph, and
     sandboxing is out of scope.
8. The host publishes the API before it imports extension modules, so a pack
   can import `comfy` in its module body. `onReady` fires once `app.setup()`
   has run and before the first workflow loads, as the legacy `setup` hook
   does. The graph is empty then, and a handle taken in `onReady` is retired
   by that first load. `onReady` never fires synchronously inside the call
   that registers the listener.

### Handles

9. A pack holds a node or a graph through a handle: a frozen object carrying
   identity, which reads the live entity each time it is asked. It exposes no
   host object. A value it returns is a frozen copy, and a property value is
   copied as the workflow would save it. Reading a handle never changes the
   node: its bounds are measured from where the node is now, as the canvas
   draws it. The Vue canvas sizes a collapsed node from its DOM, so until it
   has drawn one the width is LiteGraph's default collapsed width. Identity
   (`id`, `graphId`, `isDeleted`, `type`) is a property; a node's and a
   widget's live state is read through a method (`getTitle()`, `isPinned()`).
   The fields of slots, graph scopes and documents that V2 exposed as
   properties (`slot.name`, `scope.name`, `graph.version`) stay properties, so
   about 380 stored reads keep their spelling; a read that copies or computes
   (`snapshot()`, `links()`) is a method.
10. A handle names one entity in one graph of one loaded document.
    - It finds its graph by id under the root it came from, so it survives
      undo and redo, which rebuild the graph as new objects.
    - The host calls `beginDocument()` just before it configures the graph
      from a saved document, which restores that document's graph and node
      ids. Every earlier handle then stops resolving. A handle taken while
      that document loads belongs to it. Reloading the open workflow, as a
      language change or late custom nodes do, is such a load.
    - The outgoing document ends earlier, when the host freezes its change
      tracker to load another (`beforeLoadNewGraph`), several awaits before
      the configure. The host then calls `endDocument(graph)`: every handle
      to it is retired, and until that load finishes a handle taken in its
      graph is retired as it is made, so an edit through either returns
      `false` instead of changing a document that is no longer saved or
      tracked. That covers the handles removal hooks get while the load's
      configure removes the outgoing nodes, which with `clean: false` happens
      after `beginDocument()`: a handle taken there for node 1 would
      otherwise read the incoming node 1. The outgoing graph
      is told from the one the load configures by its id counter state,
      which every configure replaces, as the host's own
      `isCurrentGraphLoad` check tells them apart. A load replaced or failing
      after the freeze leaves the graph on screen with its handles retired;
      once the load finishes, a fresh handle works.
    - Undo and redo mark their load with `restoreHistory`. They rebuild the
      graph, so a handle whose entity is still there keeps working, and a
      handle whose entity is gone reports `isDeleted` and reads it again when
      a later undo or redo brings it back. When the load finishes, even if it
      fails part way, the host calls `afterHistoryRestore()`, which retires
      for good each handle whose entity is gone and whose id the graph could
      give to a new entity: its id is above the graph's id counter for its
      kind (`state.lastNodeId`, `state.lastGroupId`), or not a number that
      counter gives. A subgraph shares the root graph's counters, so a handle
      to a node in a subgraph that a restore dropped (a redo of removing its
      only subgraph node drops the unused definition) is judged by the root's
      counter and comes back with the subgraph. A restore sets the counter
      from the state it loads, so an undo to before a node was added rewinds
      it, and the next node added takes that id; a handle that came back to
      life would read that other node. Outside a restore the counter only grows,
      so an id at or below it is not given again until a restore rewinds it,
      and that restore retires the handle. Node ids are kept in a saved state
      (`last_node_id`); the group counter is not, so a restore sets it from
      the groups present, and a handle to the newest group a restore removes
      is retired. Slot handles name slot objects, which a restore rebuilds,
      so they are retired when a restore finds them gone.
    - A restore runs node callbacks while it configures the graph, and the
      counter it has just rewound gives the next node added the id of a node
      it left out: an `onAdded` that adds a node takes it. So just before it
      configures the graph the host calls `beforeHistoryRestore(state)`, which
      sets aside each node handle whose node `state` lacks: until the restore
      finishes it reads only the node object it named, so a removal hook the
      restore's clear calls still gets that handle and reads its node, while
      a lookup that finds another node under the id, by a callback or a hook,
      makes a new handle. `afterHistoryRestore()` then retires one whose id
      another node took, or which the counter could give again, and puts back
      the others. A removal hook used to get a new handle there, and the pack's
      own handle stayed retired after the next undo.
    - The change tracker marks a load `restoreHistory` only when it comes from
      its own undo or redo queue. A state that comes from elsewhere, such as the
      saved workflow of an earlier run that Reuse Parameters restores in Linear
      mode, can give a handle's id to another node, so it is a load. So is an
      undo or redo that steps back or forward across such a load, or across
      a load of another state into the same workflow, which keeps the
      tracker and its history (`isSameActiveWorkflowLoad` in
      `workflowService.ts`): `reset()` marks the states next to it. A load
      that puts back the state the tracker holds, as a return to an open tab
      does, leaves the history a rebuild of the document it shows, so undo
      and redo across it stay restores.
    - Clearing a graph needs no call. `LGraph.clear()` gives a root graph a new
      id, so its handles report `isDeleted`. API-JSON and A1111 imports clear
      first.
    - A node that moves to another graph, as Convert to Subgraph moves it, is
      a different entity. Its earlier handle reports `isDeleted`.
    - A node that the user, a pack or a redo removed comes back under its
      handle on any later undo or redo that restores it, however many restores
      ran in between, in the root graph or in a subgraph, unless one of them
      went back to before the node was added (under the first rule, remove,
      undo, redo, undo gave a new handle in the combined run of the stored
      packs).
    - Three cases are not detected, because a node still has the handle's id:
      a node replaced in place under the same id, as node replacement and the
      agent do on purpose, whose handle then follows the new node; a node added
      before the change tracker captured the canvas and then replaced by a
      redo, which ends when #23333 is fixed; and a load that an extension marks
      `restoreHistory`, an option meant for the change tracker. The API does
      not defend against an extension that sets it, as it does not defend
      against one that redefines the window slot, nor against one that lowers
      a graph's id counter (`last_node_id` is writable). The random ids the
      agent's collaborative mode mints do not raise the counter, so a handle
      to such a node is usually above it and is retired when a restore finds
      the node gone.
11. There is one handle per entity for as long as it stays valid, until a load
    replaces the document or an undo or redo retires it (decision 10), however
    a pack reaches it. Two handles to one entity are the same object, `sameEntity` equals
    `===` for node, group, slot, widget and graph-scope handles (it answers `false`
    for `comfy.graph`, a document handle and any other value), and a handle is
    a stable `Map` or `WeakMap` key.
12. Once an entity is gone its handle still gives its identity and reports
    `isDeleted`. Every other read returns `undefined`, a list included, and
    the types say so. A node that an undo or redo restores is the same handle
    again, unless a restore retired it while it was gone (decision 10).

### Refusals and listeners

13. A member given an argument it cannot use throws a `TypeError` naming the
    member, what it needs, and what it received, before it reads or changes
    anything: a node id and a property name must be strings, a query must be a
    plain object of `scope` and `type`, a type must be a name or a list of
    names. A positional argument beyond those a member takes is ignored, as in
    any JavaScript call. Every member follows the same rules for what a pack
    passes:
    - An object argument (options, patch, definition, item) is a plain object,
      its prototype `Object.prototype` or `null`; a list, a class instance or
      `Object.create(proto)` is refused (`checkedFields` in
      `v4/checkedFields.ts`). It is read once, as a snapshot of its own
      enumerable fields, so a getter is called once, and an inherited or
      non-enumerable field is not read.
    - A field the member does not take is refused, `__proto__` included, so a
      misspelled or cut field shows at the call. A member may list a field it
      accepts and ignores.
    - A field set to `undefined` is absent, unless the contract gives it a
      meaning: a cleared color restores the default, and a property set to
      `undefined` is deleted. `null` restores a default wherever `undefined`
      does.
    - A callback is checked once, when it is passed.
    - A value to be stored is one the workflow saves unchanged: text, a finite
      number, a boolean, `null`, or a plain object or list of those, at most
      1000 deep. A cycle, a getter, a function, `undefined` inside an object,
      `NaN`, a `Date`, a `toJSON` and a class instance are refused, naming the
      path (`value.list[0]`). One walk checks and copies it
      (`shared/savableValue.ts`), and the stored copy is not frozen.
    - A name used as a key of a host object (a type, a property, a color's
      type) is a non-empty string that is not an `Object.prototype` member
      (`isStoreKey`).
    - A refusal is one `TypeError` from `shared/invalidArgument.ts`, worded
      `<member> needs <what>, not <received>.`, where `<received>` names the
      kind (a list, a function, an instance of `Date`, `10n`) and is cut to 80
      characters. A member called at a time it cannot run says
      `<member> can only be called <when>.` Both carry the brand
      `isInvalidArgument` tests. `docs/guidance/error-handling.md` says never to throw
      across an extension-facing API, because existing packs depend on existing
      calls not throwing. No pack depended on these calls before this API, and a
      wrong argument is a mistake in the pack's code that a placeholder result
      would hide, so this is an exception to that guidance. A missing or deleted
      entity is `undefined`, never a throw. A property value the workflow could
      not save, such as a circular or BigInt one, reads as `undefined`. Each
      member reports the first one it meets and no more, as the guidance asks
      for a call over data a pack supplies.
14. Every listener the API calls goes through one primitive. Listeners run in
    registration order. One that throws is reported through `reportError` and
    does not stop the host or another pack. A disposer removes only its own
    registration and is safe to call twice. A listener added during a delivery
    waits for the next one.

## Relation to other decisions

[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
defines a document as one editing session with a session uid, and says a graph
reload is not a document transition. That uid does not exist yet. Until it
does, this API cannot tell a return to an open tab from a load of another
workflow, or a reload of the open workflow from a load of another, so
`beginDocument()` retires handles on all of them. When the uid lands it
replaces the document counter here, and a handle can then survive a tab switch
or a reload; decision 10 then no longer lists a reload as a load.

[ADR-EXTENSION-LOADING-0048](EXTENSION-LOADING-0048-late-custom-nodes-turn-on-after-the-editor-opens.md)
loads some packs after the editor opens. Such a pack registers its `onReady`
listener after readiness and is called on the next microtask.

## Alternatives considered

- Put the version in the type name, such as `Comfy_v4`. It versions one name
  out of dozens, and interfaces are erased at runtime, so it protects nothing
  a JavaScript pack binds to.
- A TypeScript `namespace`. The module is already the namespace, and
  `import * as v4` gives the same spelling.
- An unversioned `window.comfy` or a "latest" module. Every pack that used it
  would be bound to whichever version is current and would break when the next
  one is published.
- Build the published module into the bundle. Its chunk name changes per build,
  and it would need the application's singletons; the versioned slot is one
  line and is tested by running the module in a fresh process.
- Have the host find its side of the API through `window.comfy_v4`. A pack that
  wrapped the global, as packs wrap `app` today, then stopped handle retirement
  for every pack.
- Handles as proxies with a cache per access path. That design let a listener
  registered through one path miss events delivered through another.
- Hold handles weakly and release each when no pack holds it. Handle identity
  then depended on garbage collection: a pack that kept state in a `WeakMap`
  keyed by a handle lost it once it dropped the handle.
- Throw on any read of a deleted handle. Converted packs read handles
  defensively and rely on `undefined`.
- Call `beginDocument()` on every load path. On the import paths the call
  changed nothing a test could observe, because clearing already retires the
  handles.
- Keep node ids from being reissued after an undo, in core. That changes what
  undo does to the id counter, which this API does not own and which needs
  the frontend maintainers' agreement. It is filed as
  [#23333](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23333), and
  the API retires the handles itself until it is settled.
- Retire every handle on undo and redo. A handle to a node the undo did not
  touch would then die on every Ctrl+Z.
- Make a node handle's identity its id and type. It would catch reuse by a node
  of another type, and so hide the same-type case instead of removing it.
- Retire only the handles a restore removed, by recording the entities before
  it. The counter rule gives the same safety without walking the graph first;
  `beforeHistoryRestore` reads only the node ids of the state it is given.
- Retire every handle whose entity a restore finds gone, whoever removed it,
  which was the first rule. It is safe, but a node removed by the user or a
  redo and then restored by undo came back under a new handle, against
  decision 12. Whether a restore could let the id be reused is known from the
  graph's own counter, so only the handles whose id can be reused are
  retired.
- Keep every handle whose entity is gone and bring it back when an entity
  with its id returns. A node added after an undo rewinds the counter takes
  the id of the node the undo removed, and the old handle would read it.

## Workaround for a core issue

The API works around one problem in core rather than changing core. It has a
ticket, and the workaround is removed when the ticket is fixed.

- [#23333](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23333): undo
  reissues the id of a node it removed to the next node added.
  `afterHistoryRestore()` retires the handles whose entity is gone and whose
  id the counter could give again, so an id-keyed handle never names a
  different node. Once ids are not reissued, a handle can also survive a
  node's removal by undo and its return by redo: `afterHistoryRestore()`, its
  host call and the narrowing of decision 10 are removed. `restoreHistory` stays, because it is also how the host tells
  a rebuild of the open document from a load of another.
- Group ids are reissued the same way, and #23333 names only node ids: the
  0.4 workflow the change tracker keeps has no group counter, so a restore
  sets `state.lastGroupId` from the groups it loads, and after an undo to before a group was made the
  next group takes that group's id. `afterHistoryRestore()` retires group
  handles by that counter until [#23733](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23733) (group ids) is fixed as
  well; removing it when only #23333 is fixed would let a group handle read
  another group.
- The published JSDoc does not describe either workaround as behaviour, so the
  JSDoc does not commit to host bugs: `isDeleted` on node, group and
  graph-scope handles says that an undo or redo that brings the entity back
  may restore the handle or may retire it, and that a pack then takes a fresh
  one. Removing the workaround once the tickets are fixed keeps that promise,
  so a patch that removes it modifies no documented V4 feature (decision 1).

[#23332](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23332) is a
second core problem found while building this API: `LGraphNode.measure()`
without a canvas context resets a collapsed node's drawn width to 0.
`getBounds` does not depend on it, because it measures with a context.

## What this API replaces or duplicates, and why

- **Version parsing.** A strict regex in `apiVersion.ts`, not the `semver`
  package the app already depends on. `semver` accepts ranges, prerelease tags
  and loose spellings, and the Python API accepts exactly
  `v?(\d+)\.(\d+)\.(\d+)`. Using `semver` would need extra checks to
  refuse what it accepts, and the two languages would still differ in
  places.
- **Listeners.** `shared/listeners.ts`, not VueUse's `createEventHook` that
  stores use. It keeps listeners in a `Set`, so a function registered twice is
  one registration that either disposer removes; a listener that throws stops
  the delivery to the others and reaches the host; and it cannot deliver once
  and forget. Those three are the contract of decision 14.
- **A copy of a property value.** A JSON round trip in `nodeHandle.ts`, which
  is what `LiteGraph.cloneObject` does, but that function is deprecated and
  takes only an object. `structuredClone`, which it names instead, throws on a
  function and keeps values the workflow would not save. The contract is a
  copy "as the workflow would save it", which is what `serialize()` does with
  `JSON.stringify`. The deep freeze is new because nothing in the repository
  provides one.
- **Plain-object check.** `isPlainObject` from `es-toolkit`, already a
  dependency, so nothing is duplicated.
- **Geometry types.** `Point`, `Size` and `Bounds` are declared in `types.ts`,
  not taken from `shared-frontend-utils/geometry`, although its `Point2D`,
  `Size2D` and `Bounds` have the same fields. Those are mutable and belong to
  the app; a contract that names an internal type changes when the app does.
- **Measuring a node.** `getBounds` measures with a private canvas context, so
  a collapsed node has the width the canvas will draw before any frame has
  drawn it, and a node moved since the last frame is where it is now. The app's
  canvas context is not used: a subgraph that is not on screen has none to
  hand, and measuring text sets the context's font. `measure()` writes the
  width it computes into the node, so the cached width is put back afterwards,
  as `pendingBounds` in `liveGraphApplier.ts` does. That function is in
  `workbench/`, which `platform/` may not import, and it works with the canvas's
  context and a node it is about to place.
- **Whether an id can be given again.** Read from the graph's own id counters
  (`LGraph.state`), which `idAllocation.ts` mints from, rather than a record
  the API keeps of the ids it has seen: the counter is what decides the next
  id, and it is set by the same restore the API is told of.
- **The document counter.** `beginDocument()` counts loads because the session
  uid of ADR-GRAPH-DOCUMENT-0026 does not exist yet. See "Relation to other
  decisions".
- **`restoreHistory`.** The option `loadGraphData` already takes for the
  change tracker's undo and redo (#23897 uses it to keep the sizes mounted
  Vue nodes measured), not a second load method. The change tracker now sets
  it only for a state that is a rebuild of the open document: a state an undo
  or redo pushed across a load is a load (decision 10), so it is `false` there,
  and such a restore also measures node sizes afresh, as any load does. A separate method would repeat the
  load pipeline of about five hundred lines, and comparing graph ids cannot tell
  an undo from a reload of the same workflow.
- **The store.** `useComfyApiStore` holds the one API so the host reaches it
  without reading `window.comfy_v4`, and so a test can reset it. A module-level
  variable would hold the same state with no way to reset it, and reading the
  window is rejected in "Alternatives considered".
- **The dispatcher.** `useNodeApiHost` fans each host call out to the
  versions it lists. The host had no seam for several API versions; calling
  each version's store from each host file would make every new version an
  edit to `GraphCanvas.vue`, `app.ts`, `themeService.ts` and
  `extensionLoader.ts` (asked in the review of #23786). `ServedPack`, the
  backend's record of a verified pack, is in `shared/`, because every version
  takes it from the same host.
- **The published module.** A static file, not one generated by the build,
  for the reason given under "Consequences".

## Consequences

The API can change behind the handles and the root object without touching
packs, and a breaking change is a new folder and module rather than an edit.

The API is in the application bundle the host loads at startup. Measured
against `main`, it adds 113.4 KB minified (37.5 KB gzip) on its own, and the
full build grows by 225 KB raw (about 45 to 56 KB gzip, depending on
chunking): the API and the host modules it imports (widget composables,
`themeService`, `extensionService`) join the shared startup chunk, which
grows from 13.6 KB to 402 KB (4.0 to 104 KB gzip). Loading `comfyApi.ts` with
`import()` in `publish()` would take it off that path, but `publish()` must
still finish before extensions load, and about 13 host call sites would need a
no-op host until it resolves; that is left for a measured follow-up.

Host changes outside the folder:

- `GraphCanvas.vue` publishes the API before extensions load and marks it
  ready as soon as setup finishes, before the parts of the page that wait for
  `comfyAppReady` have mounted.
- `src/scripts/app.ts` calls `endDocument(graph)` when it freezes the open
  document to load another, `beginDocument()` before configuring a saved
  document, and `beforeHistoryRestore(state)` and `afterHistoryRestore()`
  around configuring an undo or redo.
  `restoreHistory` gains a JSDoc saying extensions must not set it.
- `GraphCanvas.vue`, `src/scripts/app.ts`, `themeService.ts` and
  `extensionLoader.ts` make every call into the API through
  `useNodeApiHost()` (decision 7).
- `src/scripts/changeTracker.ts` sets `restoreHistory` for a load from its
  own undo or redo queue (it set it for every restore), and remembers each state an undo or redo pushed
  across a load, and each state next to a load of another state into the
  same workflow (`reset()`), so that restoring that state is a load too
  (decision 10).

Handle retirement on import depends on `LGraph.clear()` assigning a new root
id; a test fails if that stops.

A graph's `configuring` event can cancel a load after `beginDocument()` has
run. No core listener cancels. If an extension does, the handles to the
document that stays on screen are retired, and a pack takes fresh ones.

Handles are kept until their document is replaced, so memory grows with the
number of live entities packs have asked about in the open document, and is
released on the next load. An undo or redo releases the handles it retires. A
handle to a node that is gone but may come back is kept, as identity needs:
a pack may know it only as a `WeakMap` key, and holding it weakly would make
that entry depend on garbage collection (see "Alternatives considered"). So
memory and the walk each undo makes follow every node packs have asked about
in the document, deleted ones included: measured with 10,000 nodes made and
deleted, each with a node, a widget and a slot handle taken, the handles
hold 144 MB (14.4 KB a node) until the next load, and each undo walks them,
about 30 ms at 10,000 gone node handles. A node handle with its members is
9.6 KB, about 60 closures; shrinking it, not weakening the hold, is how to
lower this. API-JSON and A1111 imports clear the graph without a
load, so handles taken before one stay held until a load, undo or redo.

Adding a version adds wiring beside this one: an import map entry in
`index.html`, a `Window` entry in `src/types/index.ts`, an ignore entry in
`knip.config.ts`, its store in the list `useNodeApiHost` dispatches to, and
the name of its node-type extension in the extension store's list of
extensions that are always enabled (ADR-EXTENSIONS-NODE-API-0071). No host
file that calls the API changes, `themeService.reapplyTypeColors` included.
Each version is its own API: its handles are its own objects, kept in its own
caches, so a v4 handle and a v5 handle to one node are two objects and
`sameEntity` of the two is `false`. A pack that moves to a new version one
file at a time compares the handles each file takes from one version.

`public/comfy/api/v4.js` is a new JavaScript file in a TypeScript-only
repository. The build already emits importable modules for `window.comfyAPI`,
but only in production builds; a static file serves development and production
alike. `knip.config.ts` lists it, because nothing in the build imports it.

The published types package exports the `v4` namespace, which its `Window`
entry names, but does not yet declare the `/comfy/api/v4.js` module. That
belongs with the documentation and typing change that completes this API.

A pack that keeps a handle across a tab switch must take a fresh one when its
document is shown again.

A pack that keeps a handle to a node an undo removes, by going back to before
the node was added, must take a new one if redo restores the node.
