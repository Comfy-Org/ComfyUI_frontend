# ADR-EXTENSIONS-NODE-API-0075: Events, documents and the queue in the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
sets out the V4 node API: one versioned object, handles scoped to a
document, refusals and one listener primitive. This decision adds what a
pack can listen to: changes to nodes, moves, drags, the view, the selection
and the running node.

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

1. Every event a pack subscribes to is built on one shared helper,
   `createHostEvent` in `nodeApi/shared/hostEvent.ts`. It refuses a listener
   that is not a function with a `TypeError` before anything changes, runs
   every listener through the listener primitive of ADR-EXTENSIONS-NODE-API-0070 decision 14,
   and follows the host only while at least one listener is registered: the
   first listener starts the host subscription and the last one to leave
   stops it. Nothing is watched, chained or subscribed for an event no pack
   listens to.
2. Listeners are delivered with the primitive's `notify`, which passes the
   event's arguments to each listener and keeps them. The primitive gains
   one member, `isEmpty`, which `createHostEvent` asks after each
   unsubscribe.

### The canvas seam

3. The node API lives in `src/platform`, and the layer rule forbids it from
   importing `src/renderer`, where the canvas store, the selection and the
   layout store live. The renderer therefore supplies a `CanvasSource`
   (`v4/canvasSource.ts`): the graph on screen, the canvas, the selected
   node ids, the node moves of each layout change and the end of each drag.
   Its reads are reactive. `useNodeApiCanvasSource` in
   `src/renderer/core/canvas/nodeApiCanvasSource.ts` implements it over
   `useCanvasStore` and `layoutStore`, and `GraphCanvas.vue` hands it to the
   store with `provideCanvas` on the line before it publishes the API, so
   it is there before any pack module runs. Until it is supplied every
   event in this section hears nothing and its disposer still works.

### Root events

4. `onNodeChanged(listener, options?)` (8 packs, 11 sites) reports a change
   to a node's title, mode, colour or body colour. It listens to the graph
   event every host writer of those fields raises,
   `node:property:changed`, so a change made by the user, a pack, an undo
   or a load is heard alike. Each event carries the node's handle, the id
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
9. `onSelectionChanged(listener)` (1 pack, 1 site) passes the selected
   nodes of the graph on screen, frozen and in the graph's own order,
   whenever that set changes. Its source is the canvas store's
   `selectedNodeIds`, the selection store's view of the graph on screen.
   That is the one selection source A-16 asks for: a selection read
   elsewhere in the API should use the same seam.
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
    `isDeleted`.
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
      the data with `validateComfyWorkflow` first and rejects with a
      `TypeError` if it is not a workflow, before anything loads. It
      resolves `true` once the host has loaded it and `false` when the host
      reports the load did not happen (A-13, and the review finding that it
      reported success for a failed load). The old contract resolved
      nothing; the packs that call it await it and ignore the value. A
      failure is a value, not a throw, as `docs/guidance/error-handling.md`
      asks.
    - `applyTextReplacements(value)` (1 pack) runs the host's
      `applyTextReplacements` over the root graph, so `%Node.widget%`
      reaches nodes in subgraphs too. Before there is a graph it returns
      `undefined` rather than the unexpanded text.
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
    that throws is reported like a listener. Overlapping calls are folded
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
    submitted, not run. It resolves `false` in every case `queuePrompt`
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

### Members left out

| Member                                                                         | Packs | Reason                                                                          |
| ------------------------------------------------------------------------------ | ----: | ------------------------------------------------------------------------------- |
| `onDocumentOpened`, `onDocumentDeactivated`                                    |     0 | No pack calls them.                                                             |
| `NodeChangeEvent.from`                                                         |     0 | No pack reads it.                                                               |
| `version`, `major`, `supports`, `require`, `capabilities`, `forMajor`, `adopt` |     0 | Left out by ADR-EXTENSIONS-NODE-API-0070; several existed only for the sandbox. |

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
- **A batch layout update does not say which positions changed.**
  `batchUpdateBounds` records the nodes whose size changed but not those
  whose position did, so `onNodeMoved` treats every entry whose size did
  not change as a move, including one rewritten to the same place. A
  `positionChangedNodeIds` list beside `sizeChangedNodeIds` would make it
  exact.
- **No session uid.** ADR-GRAPH-DOCUMENT-0026 Phase 1; decision 11 says
  what replaces it until then.
- **Execution events are not addressed to their document.**
  ADR-GRAPH-DOCUMENT-0026 decision D2; see `executingNode()` above.

## What this feature replaces or duplicates, and why

- **Listener isolation.** `createHostEvent` reuses the listener primitive
  of ADR-EXTENSIONS-NODE-API-0070, which isolates each listener through
  `callIsolated`; it adds only the start-on-first and stop-on-last rule
  that every event here needs, so no event repeats it.
- **The resolved selection.** The canvas store's `selectedNodeIds`, not the
  deprecated `canvas.selected_nodes`, which logs a deprecation warning on
  every read.
- **Execution id resolution.** `getNodeByExecutionId` from
  `utils/graphTraversalUtil`, unchanged.
- **Graph scopes.** `followGraphs` maps a scope to graphs the way
  `graphHandle.ts` does for `queryNodes`, and adds what reading does not
  need: following the user between graphs and the set of subgraphs as it
  changes.
- **A frozen copy.** `snapshot()` uses `savedCopier` from
  `shared/savedCopy.ts`, the copy the node handles use for property values.
- **Workflow validation and text replacement.** `validateComfyWorkflow` from
  the workflow schema and `applyTextReplacements` from
  `utils/searchAndReplace`, unchanged.
- **The session id.** A `WeakMap` keyed by the change tracker, in place of
  the session uid of ADR-GRAPH-DOCUMENT-0026, which does not exist yet; see
  decision 11.
