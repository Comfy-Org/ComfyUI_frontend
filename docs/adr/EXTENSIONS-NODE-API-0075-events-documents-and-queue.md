# ADR-EXTENSIONS-NODE-API-0075: Events, documents and the queue in the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
sets out the V4 node API: one versioned object, handles scoped to a
document, refusals and one listener primitive. This decision adds what a
pack can listen to (changes to nodes, moves, drags, the view, the selection
and the running node), the open documents and workflow files, the queue,
and the view of the graph a pack may move: selection, centring, zoom and
pan, and where things are on screen.

Packs heard these things before by wrapping LiteGraph callbacks
(`onPropertyChanged`, `onDrawForeground`), by installing `defineProperty`
traps on `node.mode`, by polling every few hundred milliseconds, or by
reading `app.runningNodeId` and `canvas.selected_nodes`. Each of those binds
a pack to an internal that the editor has since replaced or will replace.

Which members to build comes from the census of stored packs
(`census/CENSUS.md` in the conversion records): every member at least one
stored pack calls is built, and a member none calls is left out unless a
review finding requires it. The counts below are packs, then call sites.

## Decision

### Listening

1. Every event that follows the host is built on one shared helper,
   `createHostEvent` in `nodeApi/shared/hostEvent.ts`. It refuses a listener
   that is not a function with a `TypeError` before anything changes, runs
   every listener through the listener primitive of ADR-EXTENSIONS-NODE-API-0070 decision 14,
   and follows the host only while at least one listener is registered: the
   first listener starts the host subscription and the last one to leave
   stops it. Nothing is watched, chained or subscribed for an event no pack
   listens to. The host subscription runs in an effect scope of its own,
   detached from whatever Vue scope is active when the first listener
   subscribes, so the watches it makes belong to the event and not to the
   first pack: a pack that subscribes in a component's `setup` and whose
   component unmounts does not silence another pack's listener.
   `hostEvent.test.ts` and `selection.test.ts` pin this with a stopped scope
   and an unmounted component. `onWorkflowLoaded` and `queue.onRejected` are
   the two events the host pushes (decisions 13 and 20); there is nothing to
   follow, so they use the listener primitive directly.
2. Listeners are delivered with the primitive's `notify`, which passes the
   event's arguments to each listener and keeps them. The primitive gains
   one member, `isEmpty`, which `createHostEvent` asks after each
   unsubscribe.

### The canvas seam

3. The node API lives in `src/platform`, and the layer rule forbids it from
   importing `src/renderer`, where the canvas store and the layout store
   live. The renderer therefore supplies a `CanvasSource`
   (`v4/canvasSource.ts`): the graph on screen, the canvas, the node moves
   of each layout change and the end of each drag. Its reads are reactive. `useNodeApiCanvasSource` in
   `src/renderer/core/canvas/nodeApiCanvasSource.ts` implements it over
   `useCanvasStore` and `layoutStore`, and `GraphCanvas.vue` hands it to the
   store with `provideCanvas` on the line before it publishes the API, so
   it is there before any pack module runs. Until it is supplied every
   event in this section hears nothing and its disposer still works.

### Root events

4. `onNodeChanged(listener, options?)` (8 packs, 11 sites) reports a change
   to a node's title, mode, colour or body colour. It listens to the graph
   event every host writer of those fields raises,
   `node:property:changed`, so a change made by the user or a pack is
   heard alike. A load, an undo or a redo does not edit the nodes in
   place: `LGraph.configure` builds new ones from the saved state. A new
   node is created with its saved title and starts with mode `'always'`
   and no colours, and `LGraphNode.configure` then writes the saved mode
   and colours through the same setters. So a rebuild raises the event
   once for each saved mode other than `'always'` and each saved colour,
   whether or not it changed, and not for the saved title. An undo that puts a
   title back, or a mode back to `'always'`, is silent; a redo or load of
   a bypassed node reports `'bypass'` again. The event comes from the host's
   shell state (`setTrackedNodeState`, filed as
   [#23741](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23741)), not from the API, and the API
   passes it on as it does any other: telling a rebuild's writes from an
   edit would mean diffing the fields across `afterHistoryRestore` and each
   load, which no pack has asked for. A pack that keeps a mirror of these
   fields re-reads the nodes in `onWorkflowLoaded` (decision 13), which
   fires after every load, undo and redo. `app.test.ts` drives an edit,
   three undos, three redos and a load through the real change tracker and
   pins what is heard at each step. Each event carries the node's handle, the id
   of its graph, the property and `to`, which is what the node's matching
   read (`getTitle`, `getMode`, `getColor`, `getBgColor`) returns after the
   change, so a mode is a name such as `'bypass'` and never a number. The
   event union says which type `to` has for each property. The event is
   frozen.
   - `options.scope` takes the words `queryNodes` already uses: `'visible'`
     (the default) follows the user from graph to graph, and
     `'root-and-subgraphs'` hears the root graph and every subgraph
     definition, including one created later and not one deleted with its
     last placement. The old contract spelled the second scope
     `'document'`; five packs pass it, and the conversion rewrites it.
     Anything else, or options that are not a plain object, is refused.
   - The old event's `from` (no pack reads it) and the properties the API
     has no read for (`shape`, `showAdvanced`, `boxcolor`, error flags) are
     left out. Adding either is a patch.
5. `onNodeMoved(listener)` (3 packs, 6 sites) reports a node's new
   top-left corner, in graph space, for each move the layout store records:
   a single move, or each node of a batch whose size did not change. A
   batch entry whose size changed is a resize, which the layout store
   records in the same operation, so it is left out. The layout store keys
   nodes by root graph id; the move is named in the graph on screen first,
   then the root graph and the subgraphs, and a move in another document is
   not reported.
   - A load, an undo or a redo places every node it builds, and the layout
     store records each placement twice: first at the saved x with y 10
     (the default `pos`), then at the saved position. So `onNodeMoved`
     reports every node of the document twice, though none moved; this was
     seen in the built app under both renderers after the undo of a title
     change. The API passes on what the layout store records rather than
     filtering it, and the JSDoc says so; the ticket is under "Core
     limitations". A pack that keeps positions re-reads them in
     `onWorkflowLoaded`.
6. `onNodeDragEnd(listener)` (1 pack, 2 sites) fires when a drag ends under
   either renderer: the Vue node drag flag falls, or the canvas reports that
   it stopped dragging items. The old listener received the dragged nodes;
   the one pack that uses it ignores them, so the listener takes none.
7. `isInteracting()` (2 packs, 4 sites) is true while the canvas is
   connecting a link, resizing a node or dragging a widget. A node drag is
   not an interaction here: the packs that call it do so from
   `onNodeMoved`, during a drag, to tell their own gesture from the user's.
8. `onViewportChanged(listener)` (4 packs, 5 sites) fires when the view
   pans or zooms. LiteGraph reports both through the one callback slot
   `DragAndScale.onChanged`, which the canvas itself and the canvas store
   already chain onto. The API chains onto it the same way while it has
   listeners, calls the handler it found first, and on the last unsubscribe
   puts that handler back if no one has chained after it. If someone has,
   its handler stays in their chain and stops passing anything on. A
   viewport change event in core would remove the chaining; see
   "Consequences".
   - The canvas store does not follow that rule. `GraphCanvasMenu` calls
     `initScaleSync` when it mounts, which saves the slot's handler and
     chains its own, and `cleanupScaleSync` when it unmounts, which writes
     the saved handler back without checking that the slot still holds the
     store's. The menu is mounted only while the `Comfy.Graph.CanvasMenu`
     setting is on and builder mode is off. So when the first listener
     subscribes while the menu is mounted, the API's handler sits above
     the store's; hiding the menu or entering builder mode drops it from
     the slot, and the menu mounting again chains below it. Every listener
     is then silent until they have all left and one subscribes again,
     which chains anew. When the first listener subscribed before the menu
     mounted, the store's handler sits above the API's, and the API keeps
     hearing. The API matches the host here rather than writing around it:
     the `onViewportChanged` JSDoc says so, and
     `nodeApiCanvasSource.test.ts` pins all three cases through the real
     canvas store. The ticket is under "Core limitations".
9. `onSelectionChanged(listener)` (1 pack, 1 site) passes the selected
   nodes of the graph on screen, frozen and in the graph's own order,
   whenever that set changes. It and `graph.selection()` (decision 23) read
   one source, the host's selection store (`useSelectionStore`, from which
   the canvas store's selection is also derived), through one function,
   `selectedNodes` (A-16).
10. `executingNode()` (4 packs, 6 sites), `executionNode(id)` (3, 4) and
    `onExecutingNodeChanged(listener)` (6, 7) name the node the backend is
    running. The execution store's `executingNodeId` is an execution id,
    which may be a path such as `'12:5'` through subgraph nodes;
    `getNodeByExecutionId` resolves it in the open document's root graph,
    and the handle is the node's own, in its own graph. `executionNode`
    refuses an id that is not a string.

### Documents

11. A document is one editing session of one workflow, as
    ADR-GRAPH-DOCUMENT-0026 defines it, and the session uid that ADR plans
    does not exist yet. Until it does, the API takes the session to be the
    workflow's change tracker: `ComfyWorkflow.load()` creates one when a
    workflow is opened, `unload()` and closing drop it, and a forced reload
    from disk replaces it. That is the moment ADR-GRAPH-DOCUMENT-0026 says
    the uid is minted. The API keeps one `DocumentHandle` per change tracker
    in a `WeakMap`, so the handle and its `id` (a fresh UUID) stay the same
    through undo, redo and tab switches, a reopened workflow gets a new one,
    and nothing grows: a handle goes when its change tracker does. When the
    uid lands, the handle is keyed by it instead and nothing a pack sees
    changes. This is separate from the handle retirement of
    ADR-EXTENSIONS-NODE-API-0070 decision 10, which still treats a tab switch
    as a load.
12. `DocumentHandle` (`id` 3 packs, `name` 5, `path` 1) reads the open
    workflow live: `name` is the file name without directory or extension,
    `path` is where it is saved and `undefined` while it has never been, and
    once the document is closed `isDeleted` is true and the other reads are
    `undefined`. `isModified` is left out: no pack reads it.
13. `onWorkflowLoaded(listener)` (15 packs, 18 sites) fires after every load
    and after every undo and redo, with the open document (the settled
    decision of the rebuild plan, matching the legacy `afterLoadGraph`
    hook). The host calls `workflowLoaded()` right after it runs the
    `afterLoadGraph` extension hook, on each of the three load paths in
    `app.ts`: a saved workflow (which undo and redo also take), API JSON and
    an A1111 image. A load that fails or is overtaken returns before the
    call, so it is not announced. The document's `id` is unchanged for an
    undo or redo, which is how a pack tells them from a load.
14. `onDocumentActivated` (1 pack) and `onDocumentClosed` (2 packs) watch
    the workflow store only while they have listeners (B-12): the active
    workflow's change tracker for the first, the change trackers of the open
    workflows for the second. A closed document's handle reports
    `isDeleted`. The host also drops the change tracker of an open, inactive
    workflow whose file changed on the server (`workflowStore.ts`), so
    `onDocumentClosed` fires for that tab too, and its reloaded file opens as a
    new document.
15. `comfy.workflow`:
    - `current()` (6 packs) and `documentId()` (2) give the open document
      and its id.
    - `snapshot()` (3 packs; it was missing from the old contract) is a
      frozen copy of `rootGraph.serialize()`, made by `savedCopier` as a
      save would write it, or `undefined` before there is a graph. The old
      pack contract made it a promise because the sandbox answered across a
      worker; it is synchronous here, and a pack that awaits it still works.
    - `open(data)` (4 packs) opens the data as a new document on screen
      through the host's `loadGraphData`, as opening a file does. It checks
      the data with `validateComfyWorkflow` first. Data that is not an
      object throws a `TypeError` at the call, as every other member's
      refusal does; an object the schema refuses resolves `false` and nothing
      loads. It resolves `true` once the host has loaded it and `false` when the host
      reports the load did not happen (A-13, and the review finding that it
      reported success for a failed load). The old contract resolved
      nothing; the packs that call it await it and ignore the value. A
      failure is a value, not a throw, as `docs/guidance/error-handling.md`
      asks.
    - `applyTextReplacements(value)` (1 pack) runs the host's
      `applyTextReplacements` over the root graph, so `%Node.widget%`
      reaches nodes in subgraphs too. Before there is a graph it returns
      `undefined` rather than the unexpanded text.
    - `getExtra(document, key)` (1 pack, 1 site) returns a frozen copy,
      made by `savedCopier`, of one key of the `extra` object the
      document's workflow saves, as `getProperty` does for a node
      property: `undefined` for a key the object does not own, for a value
      a save could not write, for a closed document and for `undefined` (so
      a pack can pass `current()` or the document `onWorkflowLoaded` gives
      it). While the document is on screen the key is read from the root
      graph's live `extra`, even when the user is inside a subgraph, so a
      write in the same batch is seen; otherwise it is read from the state
      its change tracker saves, which is what the host writes to disk.
      "On screen" is the host's own test for capturing the canvas into a
      tracker: the tracker is the active workflow's, it may capture the
      canvas (`canCaptureCanvas`), and no graph is loading. Keys the host
      fills in only as it saves (`ds`, `reroutes`, `linkExtensions`,
      `linkPresentation`) are therefore in a background document's
      `extra` and not in the live one; they are the host's, not a pack's.
    - `setExtra(document, key, value)` (1 pack, 1 site) writes a copy of
      `value` into the root graph's `extra` of the document on screen,
      and `undefined` deletes the key. The write runs inside the edit core's
      `batch` (`comfy.graph.batch`), so the change tracker captures it as one undo
      step (or as part of the pack's batch), marks the workflow modified
      and saves it, and undo and redo restore `extra` with the rest of the
      graph, as the host's own app-mode selections are kept in `extra`.
      It returns `true` once written and `false` for a background, closed
      or missing document, or while a graph loads, which includes an
      `onWorkflowLoaded` listener (the host calls it before it clears
      `ChangeTracker.isLoadingGraph`): the change tracker can only capture
      the graph on the canvas. On the A1111 import path the host suppresses
      capture instead of setting that flag, so a write there returns `true`
      and makes no undo step of its own. A key that is not a string, or that is
      empty or an `Object.prototype` member (`isStoreKey`; `__proto__` would
      replace the object's prototype), a value the workflow would not save
      unchanged (`savableValue`, the walk `setProperty` and widget values use:
      `NaN`, a nested function or `undefined`, a `Date`, a getter, a cycle) and a value that is not a document handle are refused with a
      `TypeError` before anything changes. Both members take the document
      first because a document is what `extra` belongs to; the old
      contract read and wrote the active document only, and returned
      promises because the sandbox answered across a worker.
16. `registerImporter(importer)` (4 packs) adds a reader for files the host
    finds no workflow in. Every field is checked at registration (A-10):
    `id` a non-empty string no other importer has, `parse` a function,
    `enabled` a function if given, `maxBytes` a positive finite number, and
    `mimeTypes` and `extensions` lists of non-empty strings if given. The
    lists are copied then, so a pack changing them later changes nothing.
    The host line in `handleFile` passes each file, with what
    `getWorkflowDataFromFile` found in it, to `importWorkflowFile`; if that
    found a workflow, prompt, A1111 parameters or templates it is returned
    unchanged and no importer is asked. Otherwise each importer that takes
    the file's size and type or extension is asked in registration order:
    the check, `enabled()` and `parse()` all run inside that importer's own
    error boundary, so one that throws is reported with its id and the next
    is asked. The file is read once, only if an importer takes it, and each
    importer gets its own copy of the bytes. A result is a `workflow` or a
    `prompt`, a string or a plain object; an object is copied by a JSON
    round trip at that call, and anything else declines.
    - The old host never offered more than 16 MiB, a limit set for the
      sandbox's transfer to a worker; it is gone, and `maxBytes` is the
      importer's own limit.

### The queue

17. `comfy.queue` (25 packs, 61 sites) runs the workflow and hears the queue.
    It listens to two events `queuePrompt` already dispatches, and the host
    tells it three things it did not say before, each a call on its own
    line in `queuePrompt`:
    - `promptSubmitted(requestId, promptId, nodeCount)` once the backend
      accepts a prompt;
    - `promptRejected()` when the backend refuses one, both on the ordinary
      validation failure (`PromptExecutionError`) and when it answers
      without a prompt id;
    - `queueSettled()` when `queuePrompt` stops processing, in its
      `finally` and on the two early returns that drop the queued calls.
      `app.test.ts` runs each through the real `queuePrompt` (B-04, B-05),
      and each test fails when its line is removed.
18. `onBeforeRun(listener)` (8 packs) is called on the host's existing
    `promptQueueing` event, which `queuePrompt` dispatches for every call
    before the prompt is built, so a pack can still change widgets that go
    into it. A function the listener returns is a cleanup. Every cleanup is
    run once, when the host reports the queue settled, which is after every
    prompt it was processing has been sent or refused, or when the listener
    unsubscribes, whichever is first. Cleanups belong to the registration
    that made them, so one pack unsubscribing runs only its own. A cleanup
    that throws is reported like a listener. A listener that returns a promise has no
    cleanup; if the promise rejects, the rejection is reported as a
    listener's is. Overlapping calls are folded
    into one processing pass by `queuePrompt`, so "the queue settled" is
    the end of every attempt whose listener ran.
19. `onAfterRun(listener)` (7 packs) fires on the host's existing
    `promptQueued` event, once per run call that the backend accepted at
    least one prompt from, with `promptIds` (4 packs) and `submissions` (1)
    as `promptSubmitted` recorded them for that call's request id. A call
    whose every prompt was refused produces no `onAfterRun`, only
    `onRejected` (B-16). Recorded submissions are dropped when the event is
    delivered and when the queue settles, so nothing grows.
20. `onRejected(listener)` (2 packs) fires each time the backend refuses a
    prompt. The listener takes no event: every field of the old
    `RunRejectedEvent`, `RunRejectedNode` and `RunRejectionError` has no
    use in the stored packs. Adding an event argument later is a patch.
21. `run(options?)` (8 packs, 15 sites) calls the host's `queuePrompt`, as
    the Run button does. It resolves `true` once this call's prompts are
    submitted, not run, and also when a request fails without an answer
    from the backend (a network error): `queuePrompt` reports the error and
    returns what its node errors say, as it does for the Run button.
    `app.test.ts` pins that case. It resolves `false` in every case `queuePrompt`
    does (B-08): the call was folded into a run already in progress, the
    backend refused a prompt or reported node errors, or the run stopped
    before sending (a workspace switch failed, sign-in is missing, the
    workspace changed). `app.test.ts` drives each through the real
    `queuePrompt`. `options.nodes` (2 packs) runs only those nodes and what
    feeds them. Each handle is resolved by the node handles' own `locator`,
    the check the edit core uses, which finds the node in the handle's own
    graph and document (A-11, B-01). As in the edit core
    (ADR-EXTENSIONS-NODE-API-0073 decision 2), a value the API did not make
    is refused with a `TypeError`, and a handle whose node is gone or whose
    document was replaced makes `run` resolve `false`; either way nothing
    is queued. Nodes are grouped by graph and each group is turned into
    execution ids with `getExecutionIdsForSelectedNodes`; a node in a
    subgraph that is not placed in the workflow also resolves `false`. A
    subgraph placed more than once runs at its first placement, as the
    host's own partial run does. `RunOptions.batch` (0 packs) is left out.
22. `pending()` (4 packs) and `onPendingChanged` (3) read and follow the
    queue store's count of waiting prompts. `interrupt()` (2) cancels the
    running job as the host's Interrupt command does; `onInterrupted` (10)
    follows the backend's `execution_interrupted` message.
    `disableAutoQueue()` (1 pack) sets the automatic queue mode to off.

### The view

23. `graph.selection()` (9 packs, 19 sites) is decision 9's
    `selectedNodes`. `graph.select(nodes)` (12, 18) replaces the selection
    through the canvas's own `selectItems`, the host's selection owner, so
    the selection store, the canvas and the selection toolbox agree; an
    empty list clears it. Each handle is resolved with the node handles'
    `locator`, as the edit core and `queue.run` resolve them (B-01): a
    value the API did not make is refused with a `TypeError`, and if a node
    is gone or not in the graph on screen `select` returns `false` and
    nothing changes. The old `{ add }` option is left out.
    `graph.groupSelection()` (1 pack, 1 site) is the same read for groups:
    `selectedGroups` in `events/selection.ts` takes the group ids from the
    same selection store keys as `selectedNodes` (each picks one selectable
    kind, so nodes and groups never mix) and returns the graph on screen's
    group handles in draw order, frozen. A group removed from the graph is
    no longer listed, and the list is empty with no graph on screen. It is
    on the graph handle beside `selection()`, as in the old contract; the
    pack that calls it reads both on every update to find the one selected
    node or group it resizes. Selecting groups is not built: no pack asks.
24. `graph.centerOn(node)` (6, 10) resolves the node the same way and
    returns `false` when it is gone or not on screen; otherwise it calls the
    canvas's `centerOnNode`. `GroupHandle.centerOn()` (3 packs) centres the
    group's rectangle the same way, and returns `false` when the group is
    gone or its graph is not on screen. `setZoom(scale)` (2, 3) refuses
    anything but a positive finite number and calls
    `DragAndScale.changeScale` with the middle of the canvas element in
    client coordinates (A-17); the canvas clamps it to its own limits.
    `panBy(delta)` (1, 1) refuses anything but finite `x` and `y` and moves
    the view by that many screen pixels with `DragAndScale.mouseDrag`
    (A-01). Each marks the canvas dirty and recomputes the visible area, as
    a draw does, so the view redraws and `onViewportChanged` hears it at
    once (A-04). None of them edits the graph or touches undo.
25. `graph.pointerPosition()` (4, 5) is the canvas's `graph_mouse`, the
    pointer's last position in graph space, frozen, or `undefined` before
    there is a canvas.
26. `node.getScreenRect()` (4, 10) maps `getBounds()` through the canvas's
    pan and zoom onto the page, and is `undefined` when the node is gone or
    its graph is not the one on screen. `node.getSlotPosition(side, index)`
    (1, 2) is the node's own `getInputPos` or `getOutputPos`, in graph
    space, and `undefined` for a slot the node does not have or a node that
    is gone; a side other than `'input'` or `'output'`, and an index that is
    not a whole number from 0, are refused.
27. These members find the canvas through `CanvasSource`, as the events do.
    They join the handles through the factories' member hooks: the graph
    handle's `members` (whose type becomes `GraphHandleMembers`, every
    member but the reads), the node handle's `membersFor`, and a
    `centerOn` callback `createGroupHandles` now takes.

### Members left out

| Member                                                                                       | Packs | Reason                                                                                   |
| -------------------------------------------------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| `onDocumentOpened`, `onDocumentDeactivated`                                                  |     0 | No pack calls them.                                                                      |
| `NodeChangeEvent.from`                                                                       |     0 | No pack reads it.                                                                        |
| `version`, `major`, `supports`, `require`, `capabilities`, `forMajor`, `adopt`               |     0 | Left out by ADR-EXTENSIONS-NODE-API-0070; several existed only for the sandbox.          |
| `DocumentHandle.isModified`                                                                  |     0 | No pack reads it.                                                                        |
| `queue.guard`                                                                                |     0 | A veto with a deadline, built for the sandbox; the queue keeps "prepare, then clean up". |
| `queue.autoQueueMode`, `setAutoQueueMode`, `batchCount`, `setBatchCount`, `RunOptions.batch` |     0 | No pack calls them.                                                                      |
| `RunSubmittedEvent.rejected`                                                                 |     0 | No pack reads it; `onRejected` says it.                                                  |
| `RunRejectedEvent`, `RunRejectedNode`, `RunRejectionError` and their fields                  |     0 | No pack reads them; `onRejected` passes no event.                                        |
| `GraphHandle.select(options).add`                                                            |     0 | No pack uses it.                                                                         |

## Relation to other decisions

This feature sits on the definitions, widgets and edit layers
([ADR-EXTENSIONS-NODE-API-0071](EXTENSIONS-NODE-API-0071-node-definitions-and-hooks.md),
[ADR-EXTENSIONS-NODE-API-0072](EXTENSIONS-NODE-API-0072-widgets.md),
[ADR-EXTENSIONS-NODE-API-0073](EXTENSIONS-NODE-API-0073-functional-edit-core.md))
and uses what they already provide rather than a second copy:

- The listener primitive's `notify`, `callIsolated` and argument lists;
  this feature adds only `isEmpty` (decision 2).
- The edit core's undo history is the open workflow's change tracker. The
  documents of decision 11 are keyed by that same object, so a document is
  the session whose history the edit core writes to. An edit through
  the edit core changes a node through the host's setters, which raise
  `node:property:changed`, so `onNodeChanged` hears it like any other
  change. An undo or redo of that edit rebuilds the nodes instead;
  decision 4 says what of it is heard.
- `savedCopier` from `shared/savedCopy.ts` for `snapshot()`.
- `NodeHandles.locator` as the one check that a value is a live handle
  (decisions 21, 23, 24, 26), with the edit core's rule: a value the API did
  not make is a `TypeError`, a gone entity is a value.
- The handle factories' member hooks for the view members (decision 27).

## Alternatives considered

- Import the canvas store and the layout store from the API. The layer rule
  (`platform` may not import `renderer`) forbids it, and the seam keeps
  what the API reads from the renderer in one interface.
- VueUse's `useEventListener` for graph events. It binds a new target after
  the next render (`flush: 'post'`), so a change made just after the user
  enters a subgraph would be missed; `followGraphs` rebinds synchronously.
  The renderer source does use it for the canvas element's drag event,
  whose target exists long before a pack subscribes.
- One subscription per node. Node objects do not survive undo, reload or
  re-entering a subgraph, so a pack keyed on them stops hearing silently;
  one stream filtered by handle does not.
- Polling the viewport per frame. It costs work every frame whether or not
  anything changed; chaining costs nothing until the view moves.

## Consequences

Host changes outside the folder:

- `GraphCanvas.vue` supplies the canvas with `provideCanvas` before it
  publishes the API. `GraphCanvas.test.ts` mounts the component, has a pack
  subscribe while its module loads, moves a node through the layout store
  and expects the move; the test fails when the line is removed.
- `src/renderer/core/canvas/nodeApiCanvasSource.ts` is new and claimed by
  the canvas-renderer domain.
- `src/scripts/app.ts` calls `workflowLoaded()` after the `afterLoadGraph`
  hook on its three load paths, and passes each file through
  `importWorkflowFile` in `handleFile`. `app.test.ts` has a test for each
  that fails when its line is removed.
- `graphHandle.ts` types its `members` hook as `GraphHandleMembers`;
  `edit/groupHandles.ts` takes a `centerOn` callback and gives each group
  handle `centerOn()`; `edit/nodeHandleMembers.ts` leaves the two view
  members out of its return type.
- `queuePrompt` in `src/scripts/app.ts` calls `promptSubmitted`,
  `promptRejected` (twice) and `queueSettled` (three times), each on a line
  of its own; decision 17.

`onViewportChanged` chains onto a single callback slot. A typed viewport
event on `DragAndScale` or the canvas would let the API, the canvas store
and the canvas itself listen without chaining; that is a change to
LiteGraph and is not made here.

A drag-end listener cannot tell a node drag from a drag of a group or a
reroute on the classic canvas, because the canvas reports the end of any
item drag.

`executingNode()` names the node with the running execution id in the
document on screen. When the running job belongs to another open workflow,
it may name a node of the document on screen that has the same id, as the
legacy `app.runningNodeId` does; addressing execution events to the
document that queued them is ADR-GRAPH-DOCUMENT-0026 decision D2, which is
not built yet.

### Core limitations, and the change each would take

None of these is worked around by changing core; each is a limit of what
the API reports, recorded here with the change that would lift it.

- **No viewport event.** `DragAndScale.onChanged` is one callback slot that
  the canvas, the canvas store and now the API chain onto. A typed
  `viewport-changed` event on the canvas would let each listen without
  chaining; `onViewportChanged` would then listen to it.
- **The canvas store drops handlers chained after its own. ([#23740](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23740))**
  `cleanupScaleSync` restores the handler `initScaleSync` saved without
  checking that the slot still holds the store's own handler, so a handler
  chained after the store is dropped when the canvas menu unmounts
  (decision 8). Restoring only while the store's handler is still in the
  slot, and keeping the saved handler in the closure of the handler it
  installed, would keep later chains; the viewport event above would
  remove the problem.
- **A batch layout update does not say which positions changed. ([#23746](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23746))**
  `batchUpdateBounds` records the nodes whose size changed but not those
  whose position did, so `onNodeMoved` treats every entry whose size did
  not change as a move, including one rewritten to the same place. A
  `positionChangedNodeIds` list beside `sizeChangedNodeIds` would make it
  exact.
- **`changeScale` without a centre ignores where the canvas sits. ([#23747](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23747))**
  `DragAndScale.changeScale(value)` defaults the centre to half the
  element's width and height and then subtracts the element's page offset,
  so the default is off for a canvas that does not start at the page's
  top-left. `setZoom` passes the centre in client coordinates instead; the
  default should be the rectangle's centre in client coordinates.
- **A load commits each node's layout twice. ([#23745](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23745))** Configuring a graph records
  each node at its saved x and the default y, then at its saved position,
  so `onNodeMoved` reports both (decision 5). Committing the saved position
  once would make a load report one placement per node.
- **No session uid.** ADR-GRAPH-DOCUMENT-0026 Phase 1; decision 11 says
  what replaces it until then.
- **No write to a background document's history.** The change tracker
  captures only the graph on the canvas, so `setExtra` returns `false`
  for an open document that is not on screen. A tracker method that
  applies a change to its saved state and pushes the previous state onto
  its undo queue would let it write there.
- **Execution events are not addressed to their document.**
  ADR-GRAPH-DOCUMENT-0026 decision D2; see `executingNode()` above.

## What this feature replaces or duplicates, and why

- **Listener isolation.** `createHostEvent` reuses the listener primitive
  of ADR-EXTENSIONS-NODE-API-0070, which isolates each listener through
  `callIsolated`; it adds only the start-on-first and stop-on-last rule
  that every event here needs, so no event repeats it. The detached scope
  is Vue's own `effectScope(true)`, with the host subscription's stop as
  its `onScopeDispose`.
- **The resolved selection.** The selection store, not the deprecated
  `canvas.selected_nodes`, which logs a deprecation warning on every read.
  Writes go through `LGraphCanvas.selectItems`, never to the store.
- **Graph to screen coordinates.** `getScreenRect` repeats the two-line
  transform of `useCanvasPositionConversion`, which is in `src/renderer`,
  where the API may not import from; `app.canvasPosToClientPos` throws
  until setup has finished. Centring a group repeats the formula of
  `LGraphCanvas.centerOnNode`, which takes only a node.
- **A live handle.** Every handle-taking member here resolves through
  `NodeHandles.locator`, the edit core's check, not one of its own.
- **Execution id resolution.** `getNodeByExecutionId` from
  `utils/graphTraversalUtil`, unchanged.
- **Graph scopes.** `followGraphs` maps a scope to graphs the way
  `graphHandle.ts` does for `queryNodes`, and adds what reading does not
  need: following the user between graphs and the set of subgraphs as it
  changes.
- **A frozen copy.** `snapshot()` and `getExtra` use `savedCopier` from
  `shared/savedCopy.ts`, the copy the node handles use for property values;
  `setExtra` checks and copies its value with `shared/savableValue.ts`, as
  `setProperty` does.
- **The undo step.** `setExtra` writes through the edit core's `batch`, its
  runner over the change tracker, rather than calling the tracker
  itself.
- **Which document is on screen.** `setExtra` and `getExtra` ask the same
  three questions the change tracker asks before it captures the canvas
  (`activeWorkflow`, `canCaptureCanvas`, `ChangeTracker.isLoadingGraph`);
  the tracker's own `isActiveTracker` is not exported.
- **Workflow validation and text replacement.** `validateComfyWorkflow` from
  the workflow schema and `applyTextReplacements` from
  `utils/searchAndReplace`, unchanged.
- **The session id.** A `WeakMap` keyed by the change tracker, in place of
  the session uid of ADR-GRAPH-DOCUMENT-0026, which does not exist yet; see
  decision 11.
