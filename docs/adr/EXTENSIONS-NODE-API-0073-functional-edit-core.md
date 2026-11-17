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
way to change the graph. Main has two command forms. Layout has
`LayoutOperation` (positions and sizes). LiteGraph announces a graph intent
(`graphIntents.ts`) from the methods it adds and removes nodes, adds and removes
links, and sets the title, mode, collapsed and pinned fields through; when a
shared document is bound, the agent's `docOpMinter.ts` mints those intents into
the serializable operations of `@comfyorg/comfy-multi-player` (`add_node`,
`delete_node`, `connect`, `disconnect`, `set_node_field`, `set_widget`).
Colors, shapes, properties, widget saving and slot fields have neither form,
and undo restores whole snapshots that the change tracker captures. Issue
[#16852](https://github.com/Comfy-Org/ComfyUI_frontend/issues/16852) is the
follow-up for a command interface.

## Decision

### One place where an edit happens

1. `comfy.edit` holds every edit the API can make. Each function takes handles
   and plain data, and nothing else. A node edit names its node by graph id
   and node id, which a command could carry; a slot handle's id is a number
   this session gives the slot object, and `batch` takes a function, so those
   are not yet the data of a command (decision 27).
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
   exactly as it was. A patch, constraints or options object is copied once,
   each field read once, before it is checked, so a field behind a getter
   cannot pass a check with one value and be written with another. An argument that is unusable is refused even when the
   entity is gone, so a mistake in a pack shows whatever state the document is
   in. A hook on the node (`onResize`, `onConnectionsChange`, `onInputAdded`
   and the like) that throws during step 3 stops the edit part way: what was
   applied stays, step 4 still runs, the transaction closes, and the error
   reaches the caller.

3. The transaction is the change tracker's `beforeChange()` and
   `afterChange()`, which the host supplies as the optional `history` service
   (`useWorkflowStore().activeWorkflow?.changeTracker`). Nested transactions
   count, so the tracker captures once, when the outermost closes. A host with
   no open workflow supplies none, and the edit is applied with no undo step.
   The capture serializes, clones and compares the whole document, so each
   edit outside `batch` costs about as much as the document is large, and a
   loop of separate edits is quadratic. Measured in the unit environment
   (`happy-dom`, one tracker, 20 title edits): 6.5, 12, 27 and 52 ms per
   separate edit at 250, 500, 1,000 and 2,000 nodes, against 4.9, 12, 26 and
   72 ms for all 20 inside one `batch`; the API's own work is 0.008 ms per
   edit and one `serialize()` of the graph alone is 4.5, 8.8, 17 and 33 ms,
   so the cost is the host's capture, the same as for an edit the editor
   makes. The `batch` JSDoc tells a pack to loop inside one batch.
4. The handle methods packs call are kept, and each is one call into
   `comfy.edit`: `node.setTitle(title)` is `comfy.edit.updateNode(node,
   { title })`. They hold no edit logic. Their types say which call they are.
   A refusal names the handle method the pack called (`setTitle needs ...`),
   which passes its name to the `comfy.edit` call.
5. Edits are not replayable commands of their own. They call the same host
   methods the editor's own UI calls, so an edit raises the graph intent or
   layout operation that method raises, and no other (decision 27). What undo
   does for each edit is in the mutation table.

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
     reference into the node; a value JSON cannot hold (a function, a cycle, a
     BigInt) is refused, and `__proto__` is refused as a name. A node may keep
     a property's old value (its `onPropertyChanged` answers `false`, or a
     pack's hook rejects it); `updateNode` then answers `false`, and the rest
     of the patch stays applied.
   - `undefined` as a property's value deletes the property, as
     `setProperty(name, undefined)` cleared it in V2 (5 stored calls in
     cg-use-everywhere and kjnodes). The edit goes through
     `node.setProperty(name, undefined)`, so `onPropertyChanged` and a
     property widget see the change as they saw V2's, and then removes the
     name from `node.properties`, which V2 left holding `undefined`; a
     workflow saved either way has no such property. If the node or a pack's
     hook keeps a value (a refusal, or `setValue`), the value stays and the
     edit answers `false`. A deletion is one undo step, as any property edit
     is; deleting a property the node does not have changes nothing and
     answers `true`.
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
   `isResizable()`, which no stored pack calls, exists because A-09 asks that
   the choice can be read back; it reads the node's flag. The choice is not saved, and a node
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
    counter. Every edit through this API that is applied advances it (a
    `disconnect` of an unlinked slot, or a call on an entity that is gone, is
    not applied); the host advances it when nodes or links are added or
    removed and a node is collapsed or pinned, but not for a move, a resize, a
    color, a property or a widget value, and an undo or a load starts it
    again from what the rebuild counts. So a different reading says that something
    changed; an equal one does not say that nothing did.

### Slots and links

14. A slot handle names one slot object of one node. The host has no stable
    slot identity: a link records its slots by index, Vue nodes and the layout
    store key a slot by node, side and index, and names may repeat (an output's
    name comes from the backend's `RETURN_NAMES`). An index shifts when a slot
    before it is added or removed, and a name changes when a pack renames it,
    so neither can identify a slot. The handle follows its slot through both,
    and reports `isDeleted` once the slot is removed, its node is removed, or
    its document is no longer open. Undo and redo rebuild every slot as a new
    object, so a slot handle does not survive them, unlike a node handle; a
    pack takes it again from `node.inputs` or `node.outputs`. Slot handles use
    the same per-document caches as node handles, so there is one handle per
    slot and `sameEntity` works for them; `afterHistoryRestore()` retires the
    handles whose slot is no longer on its node. A slot's `id` is a string the
    API gives the slot object the first time it is asked for, kept in a
    `WeakMap`, so nothing is written to the slot.
15. `node.inputs` and `node.outputs` are collections over the live slots. A
    `SlotRef` is a slot id, else a slot name, else a plain `{ index }` with a
    whole index of zero or more and nothing else, read once. A bare number, a
    slot handle, an object of a class and an index behind a getter are
    refused, so a position is visible at the call site. A name two slots share finds nothing in `byName` and is
    refused where a pack asked for one slot (`remove`, `connectTo`,
    `moveLinksTo`).
16. `updateSlot(slot, patch)` changes a slot's name, label, translated name,
    type, colors, shape, position and direction, and an input's `widget`. A
    name another slot on the same side has is refused (A-03), so slots stay
    addressable by name. The empty name is a name no slot is addressed by,
    and it is allowed, on any number of slots of a side, as V2 allowed it
    (mxtoolkit: 5 `name` and 4 `localizedName` sites, two of them on the two
    outputs of one node): the host accepts it, as its own `Reroute` adds an
    input named `''` and renames its output to `''`, saves it, and draws no
    label for it in either renderer (`NodeSlot.renderingLabel`; Vue nodes'
    `InputSlot.vue` and `OutputSlot.vue` test for the empty name and key a
    slot by name and index), and a load keeps it on a slot the type does not
    make. `byName('')` finds such a slot only when it is the only one of its
    side so named, as for any shared name. A `widget` the node does not have
    is refused too, since it would save a socket for nothing, and so is one
    another input is already the socket of.
    `widget: null` (or `undefined`, when the patch names it) makes the input a
    plain socket again. A `position` for an input that is, or the same patch
    makes, a widget's socket is refused: the host places such an input by its
    widget and does not save its position, so the edit would answer `true`
    and change nothing; rgthree gives 25 such positions at run time, which
    the host would place by the widget anyway. A type name that is an `Object.prototype` member
    (`__proto__`, `constructor`, `toString`, alone or in a list) is refused
    for every slot edit, as `defs.define` refuses it: the host's slot-type
    registry would add the slot and then fail. An output's new type is applied through
    `setOutputDataType`, which retypes its links; an input's link is kept. A
    type given as several names is stored as the host compares it, joined by
    commas. `null` or `undefined` clears a field that has a default (label,
    localized name, colors, shape, position, direction), as the stored V2 packs
    wrote it. Decision 24 says what a load
    gives back, and decision 26 refuses a subgraph node's slots.
17. `addInput` and `addOutput` add a slot after the others through
    `node.addInput` and `node.addOutput`, with the same name rule, the empty
    name included; `removeSlot`
    removes one through `removeInput` and `removeOutput`, which drop its links
    and shift the later slots' links.
18. `reorderSlots(node, side, names)` takes each slot's name once and moves the
    slots with their links in one step (16790-48). Inputs go through the host's
    own `captureInputLayout` and `replaceNodeInputs`; outputs through one
    `updateEndpoints` call on the link store, which validates every re-pointed
    link before it moves any, and then the output list. Link ids do not change;
    the saved `links` array holds the same links, in an order that may differ.
    Floating links (links detached onto a reroute) of reordered outputs move
    with them, as part of the API's own output reorder; floating links of
    reordered inputs keep their slot index, as the host's `replaceNodeInputs`
    leaves them (#23466). If the store refuses, nothing moves and
    the call answers `false`. Decision 24 says what a load gives back.
19. `connect(output, input)` links two slots of one graph through
    `LGraphNode.connect`, so the host's type check and the nodes' connection
    hooks apply; it gives the new link, or `undefined` if the host refused.
    `disconnect(slot, target?)` removes an input's link, or an output's links
    (only those to `target` if given), through `disconnectInput` and
    `disconnectOutput`; a slot with no link answers `false` without a step.
    `moveLinks(from, to)` re-points every link of one output to another output
    of the same node through the link store, keeping the links' ids, and does
    not check types again: a pack moves links and then retypes the output.
20. The handle methods that take a node id (`output.connectTo(nodeId, input)`,
    `output.disconnect(nodeId)`) look it up in the output's own graph, never in
    the graph on screen (B-01). A node id or slot that is not there answers
    `undefined` or `false`; an id that is not a string throws.

### Groups

21. `comfy.graph.groups()` and a graph handle's `groups()` give a handle for
    each group of the graph, in draw order. A group handle names a group by its
    id in its graph and follows the same rules as a node handle: it survives
    undo and redo, which restore the id, and is retired when another document
    loads or a restore finds the group gone. It reads the group's title, color
    and bounds, and `nodes()` gives the nodes whose center, title bar
    included, is inside the group now. The centers are measured as `getBounds`
    measures a node, so the answer does not depend on the last frame drawn,
    and the group's own list of nodes, which `recomputeInsideNodes` rewrites,
    is neither read nor changed. No stored pack retitles or recolors a group
    through the API, so there is no group edit.

### Node handle members that are not edits

22. `isSerializingWidgets()`, `isResizable()` and `snapshot()` read the live
    node, and return `undefined` once it is gone. `snapshot()` is a frozen copy
    of the node's identity, title, mode, flags, colors, shape, position and
    size; a shape with no name here reads as `'default'`.
23. `addBadge(badge)` is a registration, not an edit: badges are not saved and
    make no undo step. It pushes an `LGraphBadge` onto `node.badges`, the list
    extensions already use, and returns a disposer that removes that entry
    only and is safe to call twice. An object badge is read once, when it is
    added. A function badge is one `LGraphBadge` whose text, colors and click
    handler the function sets each time the canvas draws it, so the canvas
    finds the badge it drew when the user clicks it; if the function throws or
    returns something that is not a badge, the failure is reported once and
    the badge is hidden from then on. A click handler runs through the same
    isolation as listeners. A badge lives on the node object, so it is gone
    when undo or a load rebuilds the node; a removed node gets nothing and a
    disposer that does nothing. Vue nodes compute a node's badges from
    `node.badges` in a computed value that does not track the array, so under
    Vue nodes a badge added or removed after the node is first drawn shows or
    goes only when the node's badges are next recomputed (a setting or a graph
    change the computation reads), and a function badge is called only then
    (see "Core limitations").

### Edits a load does not keep

An undo or redo is a load of a saved state (ADR-EXTENSIONS-NODE-API-0070
decision 10). The API is not stricter than the host it wraps: an edit the
legacy API and the editor apply is applied, as one undo step, even where the
next load gives back part of what it changed. This is the owner's decision
(the default the review recommended; refusing such edits threw in the stored
conversions of at least nine packs, about 45 call sites, and the class of
edits a load undoes did not close as more node families were checked). What a
load gives back is stated in the contract instead, and a refusal is kept only
where an edit makes a later load erase content the pack does not own, or
leaves the graph feeding execution the wrong data.

24. Slots a node's type makes. A load builds each node with its type's
    constructor and then merges the saved node into it.
    - A backend type (`registerNodeDef` in `litegraphService.ts`) rebuilds
      each input its constructor made, matched by name, with that input's
      `name`, `type`, `shape`, `localized_name` and `widget`, in the
      constructor's order, and any other saved input after them; each output
      its constructor made, matched by position, takes back the same fields.
      So after a load a renamed declared input is the declared input plus a
      second input under the new name, a retyped, reshaped or retranslated
      declared slot has the type's value again, a removed declared slot is
      back, a reordered one is in the type's order again, and a declared input
      that stopped being a widget's socket is one again.
    - Any other type (a `comfy.defs.define` type, one a legacy extension
      registers) gets the slots its constructor makes, with the saved slots
      merged in by position, and no list is shortened: a slot removed from the
      constructor's slots comes back, after the remaining ones, so names can
      repeat.
    - A label, colors, a position on an input that is not a widget's socket,
      and a direction are saved and kept, and so is every edit of a slot a
      pack added (a backend type keeps added inputs in their saved order).

    `updateSlot`, `removeSlot` and `reorderSlots` apply these edits, return
    `true`, and make an undo step; the `SlotPatch` and `Edits` JSDoc state
    what a load gives back. The tests in `loadLimits.test.ts` record it, and
    fail when the host starts keeping such an edit. A pack that needs one to
    last applies it again where the node is created or configured. The
    ticket draft for the host is in "Core limitations".

25. Widget saving. A backend type, a Note, a MarkdownNote and a PrimitiveNode
    turn `serialize_widgets` on in their constructors, and the flag is not
    saved, so after `false` the next load turns saving on again with no
    widget values to restore: every widget goes back to its default.
    `serializeWidgets: false` is applied as the host applies it, except on a
    Note, a MarkdownNote or a PrimitiveNode, where it is refused: their
    widgets hold only what the user typed (a note's text, a primitive's
    value) and no pack owns those types, so a pack would erase the user's
    content at the next undo, redo or reload. Of the six stored V2 calls that
    turn widget saving off (Crystools' debugger, three in rgthree, ToggleMaster,
    DebugNode), none targets those three types; each targets the pack's own
    type, where the loss is the pack's to accept.
26. A subgraph node's slots. They are its subgraph's inputs and outputs, which
    execution maps by position; an edit to the node's own list leaves it
    disagreeing with its subgraph, and a source then feeds another input. That
    corrupts what runs, so it stays refused even though the legacy API allowed
    it. `reorderSlots` on a subgraph node's inputs goes through the host's own
    `reorderSubgraphInputs`, which reorders the subgraph's inputs and the
    node's together; the node's floating links keep their slot index, as the
    host leaves them (#23466). Every
    other slot edit on a subgraph node is refused; a pack edits the subgraph's
    inputs and outputs in the subgraph. No stored V2 conversion reaches it: a
    pack extends a type by name, and a subgraph node's type is its
    subgraph's id. The host's reorder leaves other instances of the same
    subgraph in the old order ("Core limitations").

### Graph intents and the command future

27. Each edit announces what the host method it calls announces:
    `title` and `mode` (their setters) and `collapsed` (`collapse`) a
    `set_node_field` intent, `addNode` an `add_node`, `removeNode` a
    `remove_node`, `connect` and `disconnect` a `connect` or `disconnect`, and
    `position` and `size` a layout operation. The other node fields, slot
    fields, `addInput`, `addOutput` and the input reorder announce nothing, as
    the same edits made by the editor's own code do not. `moveLinks` and the
    output reorder re-point links in the link store, which raises no intent;
    the editor has no such edit, and no intent kind describes it. So in a
    session bound to a shared document these two edits, like a color change,
    reach no other participant. The API does not work around this: it keeps the
    host's behavior, and the gap is filed as a core limitation. Re-pointing by
    disconnecting and connecting would give every moved link a new id, against
    decision 19, and announcing from the API would describe changes that did not
    happen. An intent kind for endpoint changes and for slot fields and slot
    structure is a change in core, owned by the core maintainers. The API does
    not fix this bug; once core fixes it, these calls are correct with no change
    to the API. For `comfy.edit` to
    be a command interface, slot handles would also need an id that a saved
    document carries, which the host does not have (decision 14).

## The mutation table

"Step" is what one call does to undo history when the host has an open
workflow. Every edit advances its graph's version. "Refused" is what an
unusable argument leaves: always the document unchanged, with a `TypeError`.
"Gone" is what a call does with a handle whose entity is deleted or whose
document is no longer open.

| Edit                                     | Host owner it goes through                                                                                            | Step                                                                   | Gone                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `updateNode` `title`                     | `LGraphNode.title` setter: node state store and a `set_node_field` graph intent                                       | One step                                                               | `false`, nothing changed               |
| `updateNode` `mode`                      | `LGraphNode.mode` setter: node state store and a `set_node_field` graph intent                                        | One step                                                               | `false`                                |
| `updateNode` `collapsed`                 | `LGraphNode.collapse(true)`: flag and a `set_node_field` graph intent                                                 | One step                                                               | `false`                                |
| `updateNode` `color`, `bgColor`, `shape` | `LGraphNode` setters: node state store                                                                                | One step                                                               | `false`                                |
| `updateNode` `properties`                | `LGraphNode.setProperty` per name: `onPropertyChanged`, property widgets; `undefined` then deletes the name           | One step                                                               | `false`                                |
| `updateNode` `serializeWidgets`          | `LGraphNode.serialize_widgets`; `false` refused on a Note, MarkdownNote or PrimitiveNode (decision 25)                | One step; a load gives the type's own value                            | `false`                                |
| `updateNode` `position`                  | `LGraphNode.pos` setter: a `moveNode` layout operation                                                                | One step                                                               | `false`                                |
| `updateNode` `size`, `sizeConstraints`   | `LGraphNode.setSize`: a `resizeNode` layout operation, then `onResize`                                                | One step                                                               | `false`                                |
| `updateNode` `resizable`                 | `LGraphNode.resizable` (node state store); reapplied after pin changes                                                | No step: not saved                                                     | `false`                                |
| `updateNode` with several fields         | All of the above in one transaction                                                                                   | One step for the patch                                                 | `false`                                |
| `removeNode`                             | `LGraph.remove`: links, stores, selection, `node:removed`, `remove_node` graph intent                                 | One step                                                               | `false`                                |
| `addNode`                                | `LiteGraph.createNode`, then `LGraph.add`: id, stores, layout, `onNodeAdded`, `add_node` graph intent                 | One step                                                               | `undefined`, nothing added             |
| `updateSlot`                             | The slot's own fields; `setOutputDataType` for an output's type; refused on a subgraph node (decision 26)             | One step                                                               | `false`                                |
| `addInput`, `addOutput`                  | `LGraphNode.addInput`, `addOutput`; refused on a subgraph node                                                        | One step                                                               | `undefined`, nothing added             |
| `removeSlot`                             | `LGraphNode.removeInput`, `removeOutput`; refused on a subgraph node                                                  | One step                                                               | `false`                                |
| `reorderSlots`                           | Inputs: `replaceNodeInputs`, or `reorderSubgraphInputs` on a subgraph node; outputs: `updateEndpoints`, then the list | One step; `false` if the link store refuses, slots and links unchanged | `false`                                |
| `connect`                                | `LGraphNode.connect`: the type check, `onConnectInput`, `onConnectionsChange`, a `connect` graph intent               | One step; `undefined` if the host refuses                              | `undefined`                            |
| `disconnect`                             | `LGraphNode.disconnectInput`, `disconnectOutput`: `onConnectionsChange`, a `disconnect` graph intent                  | One step; `false` and no step for a slot with no link                  | `false`                                |
| `moveLinks`                              | The link store's `updateEndpoints`, all links validated before any moves                                              | One step; `undefined` if the store refuses, links unchanged            | `undefined`                            |
| `batch`                                  | The change tracker's transaction around the pack's function                                                           | One step for all edits inside                                          | Each edit inside answers for itself    |
| `addBadge` (registration)                | `LGraphNode.badges`                                                                                                   | No step: not saved                                                     | No badge, a disposer that does nothing |

Groups have no edits (decision 21), so no group row is here: every group
member reads.

A step is captured only if the serialized graph changed, so an edit that
changes nothing a workflow saves (a title set to itself) adds no entry.
An edit the host declines once it is applied (a link `connect` will not make,
an update the link store rejects) still advances the graph's version, and the
tracker records nothing, because the saved graph did not change.

## What is left out

Counts are stored packs and call sites from the member census of the earlier
contract. A member no stored pack calls is cut.

| Member                                                                                                                                                      |               Packs, sites | Why                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GraphHandle.remove(id)`                                                                                                                                    |                       0, 0 | `node.remove()` and `comfy.edit.removeNode` cover it                                                                                                                                                                    |
| `NodeHandle.setPinned`, `getShape`, `getSizeConstraints`                                                                                                    |                       0, 0 | No use; `snapshot()` reads the shape                                                                                                                                                                                    |
| `GroupHandle.setTitle`, `setColor`                                                                                                                          |                       0, 0 | No use, so there is no group edit                                                                                                                                                                                       |
| `SlotCollection.get`, `ids`; `SlotOptions.localizedName`, `position`, `direction`                                                                           |                       0, 0 | No use; `byId`, `at` and `byName` remain                                                                                                                                                                                |
| `SlotSnapshot.*` fields read on their own                                                                                                                   |                       0, 0 | `snapshot()` is used (3 packs) and returns them all                                                                                                                                                                     |
| `GraphHandle.select`, `selection`, `centerOn`, `setZoom`, `panBy`, `pointerPosition`; `GroupHandle.centerOn`; `NodeHandle.getScreenRect`, `getSlotPosition` | 12, 9, 6, 2, 1, 4; 3; 4, 1 | View state, not document edits: no undo step, no command. They belong with the viewport and selection events (A-04, A-16, A-17 apply there)                                                                             |
| `NodeHandle.getOutputImages`, `getDisplayedImageIndex`                                                                                                      |                       8, 4 | Execution output, not graph state                                                                                                                                                                                       |
| `GraphHandle.resolvedSupplies`, `GraphScopeHandle.resolvedSupplies`, `InputSlotHandle.resolvedSource`                                                       |                    1, 1, 2 | Frontend execution's resolvers own them                                                                                                                                                                                 |
| `GraphHandle.replace`, `duplicate`                                                                                                                          |                       3, 1 | The host has no owner for rebuilding a node as another type with its state and links (`useNodeReplacement` serves missing backend types and its planning is private); building one here would be a second mutation path |
| `InputSlotHandle.widgetConfig`, `mergeWidgetConfig`; `InputSlotPatch.widgetConfig`; `SlotOptions.widgetConfig`                                              |                 3, 2; 5; 4 | They rebuild a connected Primitive node's widget from an input spec, which is the widget owner's work                                                                                                                   |
| `NodeHandle.widgets`                                                                                                                                        |                        101 | The widget collection is its own feature                                                                                                                                                                                |

Nothing in this feature existed only for the sandbox the earlier API was
built for. Its closed proxies are replaced by frozen objects, as in
ADR-EXTENSIONS-NODE-API-0070.

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
- **A JSON copy of a property value.** A second JSON round trip beside
  `shared/savedCopy.ts`, which reads properties: that one reports a value that
  cannot be saved once and reads it as `undefined`, and freezes the copy; a
  write must refuse such a value at the call and store an unfrozen copy, so
  the two do not share code.
- **Clamping.** `fitToConstraints` uses `clamp` from `es-toolkit`.
- **Mode names.** The table `nodeHandle.ts` reads modes with is reused in both
  directions. The shape names are new: LiteGraph's `NAMED_SHAPES` maps names to
  shapes but is not exported, so the snapshot keeps the reverse table, and the
  write passes the name to the node's setter, which uses LiteGraph's table.
- **The isolated call** (`callIsolated` in `shared/listeners.ts`). It is the
  call the listener primitive already made, exported so a badge function and a
  click handler report the same way.
- **Undo grouping.** `batch` is the change tracker's own counting transaction,
  not a second one.
- **Slot ids** (`edit/slotIds.ts`). The host keys a slot by node, side and
  index (`slotId` in `graph-model`), which changes when slots move, so a
  handle's id cannot be that key. The API numbers slot objects in a `WeakMap`
  instead, which writes nothing to the slot and frees the number with it.
- **Slot shape and direction names** (`edit/slotVocabulary.ts`). LiteGraph has
  `RenderShape` and `LinkDirection` but no names for them that a pack could
  pass; the names are the earlier contract's, used by the stored packs.
- **Reordering outputs.** The host reorders inputs atomically
  (`replaceNodeInputs`) but has no counterpart for outputs; the API re-points
  the outputs' links in one `updateEndpoints` call, the store's own atomic
  update, and then reorders the list.
- **A group's nodes.** `LGraphGroup.recomputeInsideNodes` rewrites the
  group's node list and sorts the graph's groups, so reading through it would
  change the host. `nodes()` applies the same rule, `containsCentre` from
  LiteGraph's `measure.ts`, to each node's bounds as `getBounds` measures them.

## Core limitations

- **A load gives back slots a type makes.** `registerNodeDef`'s `configure`
  rebuilds a backend node's declared slots from its definition, and
  `LGraphNode.configure` merges saved slots into the constructor's slots by
  position without shortening the lists (decision 24). Ticket draft:
  _Title:_ "A load undoes edits to the slots a node's type makes". _Reproduction:_
  rename `KSampler`'s `model` input (`node.inputs[0].name = 'mdl'`), save and
  load: the node has `model` unlinked and an extra `mdl` input with the link;
  or register a type whose constructor adds inputs `a` and `b`, add a node,
  `node.removeInput(0)`, `graph.configure(graph.serialize())`: the node has
  inputs `b`, `b`. _Direction:_ let the saved slot list be the node's slot list
  (shorten to the saved length, keep a saved slot's name, type, shape and
  order), and match a backend type's declared slots to it by a slot id rather
  than by name or position.
- **Reordering one instance of a subgraph.** `reorderSubgraphInputs` reorders
  the subgraph's inputs and the one node it is given; another node of the same
  subgraph keeps the old order, so its links feed other inputs. Ticket draft:
  _Title:_ "Reordering a subgraph's inputs from one instance leaves its other
  instances in the old order". _Reproduction:_ place a subgraph twice, call
  `reorderSubgraphInputs` on one instance with a new order: the other
  instance's inputs keep the old order while the subgraph's change.
  _Direction:_ reorder every instance's inputs in the same call.
- **Slot identity across undo.** Undo and redo rebuild slots, and the host
  has no slot id to find them by, so slot handles do not survive them (decision
  14). Ticket draft: _Title:_ "Give node slots an id that survives
  serialization". _Reproduction:_ keep a reference to `node.inputs[0]`, press
  Ctrl+Z, and the node's first input is a different object with nothing that
  identifies it as the same slot. _Direction:_ a slot id kept in the saved
  workflow, as links keep theirs.
- **Size limits after the call.** No host owner holds a node to a declared
  minimum and maximum size in both renderers: LiteGraph's resize uses
  `computeSize` and `constructor.min_height`, and the Vue renderer reads the
  element's CSS `min-width` and measures content. Ticket draft: _Title:_ "Give
  nodes a declared minimum and maximum size that both renderers honour".
  _Reproduction:_ set `node.onResize` to clamp the size, switch to Nodes 2.0,
  and drag the node's corner below the clamp: the node shrinks. _Direction:_ a
  min/max size in the node's layout state, read by `useNodeResize` and by
  LiteGraph's resize.
- **Floating links on a reorder.** The host keeps a link detached from a
  reroute as a floating link with a slot index. `replaceNodeInputs`, the host's
  own reorder for inputs, does not move them (`removeInput` and `removeOutput`
  do). The API does not work around this: an input reorder leaves floating
  links where the host leaves them, and the API is correct once
  [#23466](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23466) is
  fixed.
- **No intent for re-pointed links or slot edits (a requirement for release).**
  `moveLinks` and the output reorder update link endpoints in the link store,
  and slot fields and slot structure change without an intent, so none of them
  reaches the shared document's operations (decision 27). Filed as
  [#23382](https://github.com/Comfy-Org/ComfyUI_frontend/issues/23382); the API
  keeps the host's behavior and is correct once the ticket is fixed.
- **Badges under Vue nodes.** `usePartitionedBadges` computes a node's badges
  from `node.badges`, a plain array no reactive state depends on, so a badge an
  extension adds or removes after the node is drawn shows or goes only when
  something else makes the computation run again.
  The API cannot make that array reactive without changing a host object's
  field. Ticket draft: _Title:_ "Vue nodes do not show a badge added after the
  node is drawn". _Reproduction:_ with Nodes 2.0 on, push an `LGraphBadge`
  onto `node.badges` of a node on screen and call `node.setDirtyCanvas(true)`:
  the classic renderer shows it, Vue nodes do not. _Direction:_ a badge list
  in the node's reactive state, or a revision the composable reads.
- **A resizable choice after undo.** Undo rebuilds nodes from the saved
  workflow, which does not hold the flag, so the choice is lost. Saving it
  would change the workflow format.

## Consequences

- An edit through the API is one undo step and marks the workflow modified,
  through the same tracker as the editor's own edits. A node whose type is not
  installed is saved as it was loaded, with only its mode and position taken
  from the node, so any other edit to it is applied on screen, answers `true`
  and is not saved, exactly as an edit the editor makes to such a node.
- Every edit advances its graph's version, including edits that LiteGraph
  itself does not count (a title, a color); the version does not see changes
  made outside the API that LiteGraph does not count (decision 13).
- The node handle carries the edit methods through the `membersFor` parameter
  of `createNodeHandles`, which builds each handle with the members another module
  supplies and then freezes it. `NodeHandles` gains `locator`, which gives,
  for a handle it made, the function that finds its node in the handle's own
  graph and document; every call that takes a node handle goes through it.
  `createGraphScopes` returns the same kind of `locator` for graph handles
  beside `scopeFor`, and `createGraphHandle` and `createGraphScopes` take the
  members another module adds to their handles. `nodeHandle.ts` exports
  `boundsOnCanvas`, so a group measures nodes the way `getBounds` does.
- The first `resizable` choice installs one graph-intent listener for the life
  of the page, shared by every API instance, so two instances do not apply a
  choice twice.
