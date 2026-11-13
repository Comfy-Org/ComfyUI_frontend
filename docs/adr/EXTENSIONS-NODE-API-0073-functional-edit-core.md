# ADR-EXTENSIONS-NODE-API-0073: A functional edit core for the V4 node API

Date: 2026-11-12

## Status

Proposed

## Context

[ADR-EXTENSIONS-NODE-API-0070](EXTENSIONS-NODE-API-0070-versioned-node-api-with-document-scoped-handles.md)
gave packs read-only handles. Packs also change the document: they retitle,
recolor, move and resize nodes, set properties, add and remove nodes, wire
slots and reshape them. The stored V2 packs make these calls through methods on
the handles (`node.setTitle(...)`, `slot.modify(...)`), and 121 of them have at
least one such call, so the methods have to keep working.

The review of the earlier API
([#16790](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16790#discussion_r3927590595))
asked that edits be serializable commands and that handles not become a second
way to change the graph. Main has a serializable command form only for layout
(`LayoutOperation`: positions and sizes). Titles, modes, links, slots, adding
and removing go through LiteGraph's own methods, and undo restores whole
snapshots that the change tracker captures. Issue
[#16852](https://github.com/Comfy-Org/ComfyUI_frontend/issues/16852) is the
follow-up for a command interface.

## Decision

### One place where an edit happens

1. `comfy.edit` holds every edit the API can make. Each function takes handles
   and plain data, and nothing else, so a call is already the data a command
   would carry.
2. Each edit runs in four steps, in this order:
   1. It checks every argument a pack passed, and throws a `TypeError` from
      `invalidArgument` for the first it cannot use. Numbers must be finite.
   2. It resolves each handle in the handle's own graph and document, through
      the seams the handle factories expose (`NodeHandles.locator`). A value
      that is not a handle this API made throws. A handle whose entity is gone,
      or that belongs to a document no longer open, makes the edit return
      `false` (or `undefined` where it returns a handle), and nothing changes.
   3. It applies the change through the host's own owner of that state (see
      the mutation table), inside one change-tracker transaction.
   4. It advances the version of the graph it changed and marks it for redraw.

   Steps 1 and 2 finish before step 3 starts, so a refusal leaves the document
   exactly as it was. An argument that is unusable is refused even when the
   entity is gone, so a mistake in a pack shows whatever state the document is
   in.

3. The transaction is the change tracker's `beforeChange()` and
   `afterChange()`, which the host supplies as the optional `history` service
   (`useWorkflowStore().activeWorkflow?.changeTracker`). Nested transactions
   count, so the tracker captures once, when the outermost closes. A host with
   no open workflow supplies none, and the edit is applied with no undo step.
4. The handle methods packs call are kept, and each is one call into
   `comfy.edit`: `node.setTitle(title)` is `comfy.edit.updateNode(node,
   { title })`. They hold no edit logic. Their types say which call they are.
5. Edits are not replayable commands. Main has no command form for anything but
   layout, and these functions call the same host methods the editor's own UI
   calls. What undo does for each edit is in the mutation table. When main
   grows commands, each function here can construct one from its arguments
   without changing what a pack calls.

### Node edits

6. `updateNode(node, patch)` changes the fields `patch` names and leaves the
   rest. Every field is checked before any is applied, and they are applied in
   a fixed order (title, mode, collapsed, colors, shape, properties,
   serializeWidgets, position, size, sizeConstraints, resizable) whatever the
   order of the patch's keys, so a patch with `size` and `sizeConstraints` fits
   the new size to the constraints.
   - `mode` is a name (`'always'`, `'bypass'`, ...); a number is refused, as
     the reads never return one.
   - `color` and `bgColor` take a string, or `undefined` to restore the
     default. `shape` takes `'default'` to restore it.
   - `collapsed` collapses or expands the node even when it is pinned, as the
     earlier API did; nothing happens if it is already as asked.
   - `properties` sets each named property through `node.setProperty`, so the
     node's `onPropertyChanged` and property widgets see it. Each value is
     stored as the workflow saves it (a JSON copy), so a pack cannot keep a
     reference into the node; a value JSON cannot hold (a function,
     `undefined`, a cycle, a BigInt) is refused, and `__proto__` is refused as a
     name.
   - `position` and `size` need finite numbers, and a size cannot be negative
     (A-01). `size` goes through `node.setSize`, so `onResize` runs.
7. `sizeConstraints` resizes the node into the limits once, when it is
   applied: width and height are clamped between their minimum and maximum, and
   `autoHeight` first sets the height to `node.computeSize()`'s. A later resize,
   by the user or a pack, is not held to them. Each limit must be finite and
   zero or more, and a minimum may not exceed its maximum. Holding a node to
   limits after the call needs a host owner that both renderers honour, which
   does not exist (see "Core limitations").
8. `resizable` is the pack's choice of whether the user may resize the node
   (A-09). The node's flag is set to the choice unless the node is pinned.
   LiteGraph's `pin()` overwrites the flag, so the API keeps each choice in a
   `WeakMap` keyed by the node and, on every pin change it hears through
   `onGraphIntent` (`set_node_field`, `flags.pinned`), reapplies the choice of
   that node. The listener is installed the first time a pack sets the field.
   `isResizable()` reads the node's flag. The choice is not saved, and a node
   that undo or a load rebuilds has none.
9. `removeNode(node)` removes the node through `LGraph.remove`, which removes
   its links. It returns `false` if the node is gone or the host keeps it (a
   node marked `ignore_remove`).
10. `batch(edits)` runs a pack's function now, inside one transaction, and
    returns what it returns. An `async` function is refused before it runs
    (A-19), because only the edits made before the function returns can be in
    the step. A plain function that returns a promise is not refused: the
    edits it made before returning are one step, and later edits are separate
    steps. If the function throws, the edits it made stay, the transaction is
    closed, and the error is rethrown: the API cannot roll back an edit,
    because main has no inverse for most of them.

### Graph edits

11. `addNode(graph, type, init?)` takes the graph as a graph handle
    (`comfy.graph.root()` or one of `comfy.graph.subgraphs()`), so a pack can add
    to a subgraph that is not on screen and an edit never depends on what the
    user is looking at. It makes the node with `LiteGraph.createNode`, giving
    it its title and position before `LGraph.add` (A-18), so the graph's
    `onNodeAdded`, the layout store and `node:added` see it where it will
    stay. It returns the new node's handle, or `undefined`, adding nothing, if
    the graph is gone or the type is not registered: a pack's backend nodes may
    not be installed, so a missing type is a state of the app, not a mistake in
    the pack.
12. `comfy.graph.add(type, init?)` is `addNode` on the graph on screen, and
    `comfy.graph.batch` is `comfy.edit.batch`. With no graph on screen, `add`
    still checks its arguments and returns `undefined`.
13. `comfy.graph.links()` lists the links of the graph on screen as frozen
    `LinkInfo` records, sorted by link id so the order does not depend on how
    the graph was loaded. `comfy.graph.version` is the graph's own version
    counter, which every edit through this API advances.

### Node handle members that are not edits

14. `isSerializingWidgets()`, `isResizable()` and `snapshot()` read the live
    node, and return `undefined` once it is gone. `snapshot()` is a frozen copy
    of the node's identity, title, mode, flags, colors, shape, position and
    size; a shape with no name here reads as `'default'`.
15. `addBadge(badge)` is a registration, not an edit: badges are not saved and
    make no undo step. It pushes an `LGraphBadge` onto `node.badges`, the list
    extensions already use, and returns a disposer that removes that entry
    only and is safe to call twice. An object badge is read once, when it is
    added. A function badge is called each time the badge is drawn; if it
    throws or returns something that is not a badge, the failure is reported
    once and the badge is hidden from then on. A click handler runs through the
    same isolation as listeners. A badge lives on the node object, so it is
    gone when undo or a load rebuilds the node; a removed node gets nothing and
    a disposer that does nothing.

## The mutation table

"Step" is what one call does to undo history when the host has an open
workflow. Every edit advances its graph's version. "Refused" is what an
unusable argument leaves: always the document unchanged, with a `TypeError`.
"Gone" is what a call does with a handle whose entity is deleted or whose
document is no longer open.

| Edit                                     | Host owner it goes through                                                            | Step                          | Gone                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------- |
| `updateNode` `title`                     | `LGraphNode.title` setter: node state store and a `set_node_field` graph intent       | One step                      | `false`, nothing changed               |
| `updateNode` `mode`                      | `LGraphNode.mode` setter: node state store and a `set_node_field` graph intent        | One step                      | `false`                                |
| `updateNode` `collapsed`                 | `LGraphNode.collapse(true)`: flag and a `set_node_field` graph intent                 | One step                      | `false`                                |
| `updateNode` `color`, `bgColor`, `shape` | `LGraphNode` setters: node state store                                                | One step                      | `false`                                |
| `updateNode` `properties`                | `LGraphNode.setProperty` per name: `onPropertyChanged`, property widgets              | One step                      | `false`                                |
| `updateNode` `serializeWidgets`          | `LGraphNode.serialize_widgets`                                                        | One step                      | `false`                                |
| `updateNode` `position`                  | `LGraphNode.pos` setter: a `moveNode` layout operation                                | One step                      | `false`                                |
| `updateNode` `size`, `sizeConstraints`   | `LGraphNode.setSize`: a `resizeNode` layout operation, then `onResize`                | One step                      | `false`                                |
| `updateNode` `resizable`                 | `LGraphNode.resizable` (node state store); reapplied after pin changes                | No step: not saved            | `false`                                |
| `updateNode` with several fields         | All of the above in one transaction                                                   | One step for the patch        | `false`                                |
| `removeNode`                             | `LGraph.remove`: links, stores, selection, `node:removed`, `remove_node` graph intent | One step                      | `false`                                |
| `batch`                                  | The change tracker's transaction around the pack's function                           | One step for all edits inside | Each edit inside answers for itself    |
| `addBadge` (registration)                | `LGraphNode.badges`                                                                   | No step: not saved            | No badge, a disposer that does nothing |

A step is captured only if the serialized graph changed, so an edit that
changes nothing a workflow saves (a title set to itself) adds no entry.

## Alternatives considered

- **Handle methods as the place edits happen**, as in V2. The review's
  objection was that handles became a second mutation authority; with every
  method a call into one core there is one place to audit and, later, to route
  to commands.
- **Read-only handles, with packs moved to the functional calls.** Not on
  offer: a checker could prove only 40% of the stored mutator calls are handle
  edits, so the conversion cannot be done by a script.
- **One function per field** (`setTitle(node, title)`). A patch per kind of
  entity is the smaller surface, carries several fields as one step, and is
  already the shape of a command's data.
- **Edits on `comfy.graph`.** `comfy.graph` reads and `comfy.edit` writes, so a
  reader can find every write in one place.
- **Rolling back a failed batch.** Main has no inverse for most edits, and
  restoring the tracker's last snapshot would also discard edits the user made
  before the batch. A thrown batch keeps its edits as one step.
- **Holding size constraints with a resize hook on the node**, as V2 did by
  chaining `node.onResize`. The Vue renderer's resize does not call it, so it
  held the limits under one renderer only, and it put API behaviour on host
  objects.
- **Throwing for a deleted entity.** ADR-EXTENSIONS-NODE-API-0070 decision 13 makes a missing
  entity a value, never a throw; an edit returns `false` the way a read returns
  `undefined`.
- **A bare id for the node an edit targets.** An id names a node only within
  its graph and document; resolving one in the graph on screen is the defect
  the reviews reproduced (B-01). Every edit takes the handle.

## What this feature replaces or duplicates, and why

- **Argument checks** (`edit/checkedArguments.ts`). The repository has no
  validator for untyped values that names the call and the field, and the
  checks must run before any write. `isPlainObject` comes from `es-toolkit`.
- **A JSON copy of a property value.** The same round trip `nodeHandle.ts`
  reads properties with, so what is stored is what is saved; here a value that
  cannot be saved is refused rather than read as `undefined`.
- **Mode names.** The table `nodeHandle.ts` reads modes with is reused in both
  directions. The shape names are new: LiteGraph's `NAMED_SHAPES` maps names to
  shapes but is not exported, so the snapshot keeps the reverse table, and the
  write passes the name to the node's setter, which uses LiteGraph's table.
- **The isolated call** (`callIsolated` in `shared/listeners.ts`). It is the
  call the listener primitive already made, exported so a badge function and a
  click handler report the same way.
- **Undo grouping.** `batch` is the change tracker's own counting transaction,
  not a second one.

## Core limitations

- **Size limits after the call.** No host owner holds a node to a declared
  minimum and maximum size in both renderers: LiteGraph's resize uses
  `computeSize` and `constructor.min_height`, and the Vue renderer reads the
  element's CSS `min-width` and measures content. Ticket draft: _Title:_ "Give
  nodes a declared minimum and maximum size that both renderers honour".
  _Reproduction:_ set `node.onResize` to clamp the size, switch to Nodes 2.0,
  and drag the node's corner below the clamp: the node shrinks. _Direction:_ a
  min/max size in the node's layout state, read by `useNodeResize` and by
  LiteGraph's resize.
- **A resizable choice after undo.** Undo rebuilds nodes from the saved
  workflow, which does not hold the flag, so the choice is lost. Saving it
  would change the workflow format.

## Consequences

- An edit through the API is one undo step and marks the workflow modified,
  through the same tracker as the editor's own edits.
- Every edit advances its graph's version, including edits that LiteGraph
  itself does not count (a title, a color).
- The node handle carries the edit methods through an `extend` seam in
  `createNodeHandles`, which builds each handle with the members another module
  supplies and then freezes it. `NodeHandles` gains `locator`, which gives,
  for a handle it made, the function that finds its node in the handle's own
  graph and document; every call that takes a node handle goes through it.
  `createGraphScopes` returns the same kind of `locator` for graph handles
  beside `scopeFor`, and `createGraphHandle` takes the members another module
  adds to the graph handle.
- The first `resizable` choice installs one graph-intent listener for the life
  of the API.
