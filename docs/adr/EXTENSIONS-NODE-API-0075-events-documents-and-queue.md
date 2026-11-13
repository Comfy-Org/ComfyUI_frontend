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
