# ADR-CANVAS-SELECTION-0028: Single Selection Store and Gesture Reducer

Date: 2026-09-04

## Status

Proposed

## Context

Selection of nodes, groups, and reroutes has no single owner. The fact "node 7
is selected" is stored in at least seven places that are kept aligned by caller
discipline rather than by structure: `item.selected`, `canvas.selectedItems`,
the deprecated `canvas.selected_nodes`, `canvas.highlighted_links`, the
`state.selectionChanged` pulse, `canvas.current_node`/`selected_group`, and the
Vue mirror `canvasStore.selectedItems`, which 16 manual `updateSelectedItems()`
calls refresh.

Two click-selection algorithms exist, one in `LGraphCanvas.processSelect` and
one in the Vue composables `handleNodeSelect` and
`toggleNodeSelectionAfterPointerUp`. Three marquee policies exist:
`_handleMultiSelect`, `handleLiveSelect`, and the Vue path. They disagree on
what Shift, Ctrl, and Alt mean.

The click-versus-drag decision is spread across 15 `pointer.onClick` and 10
`pointer.finally` assignment sites in `LGraphCanvas`. Assignment order matters
because the `CanvasPointer.finally` setter runs the previous cleanup when a new
one is assigned. `CanvasPointer` also promotes a press to a drag after
`bufferTime` elapses, so a slow click becomes a drag without pointer movement.

Executed tests against the real `LGraphCanvas` confirmed these defects:

- `select()` and `deselect()` do not fire `onSelectionChange`; `processSelect`
  does; `deselectAll` fires only when the set size changed.
- Shift+Alt marquee yields `{A, B, C}` under classic selection and `{B, C}`
  under live selection; classic `_handleMultiSelect` never requests a redraw.
- Space keyup writes `read_only = false` unconditionally, discarding a
  persistent read-only setting.
- With `groupSelectChildren`, Shift-toggling a selected group leaves its
  children selected and reported through `onSelectionChange`.
- Nested groups never receive `onSelected`; the hook fires only in the
  `LGraphNode` branch of `select()`.
- Raw `selectedItems.clear()` leaves `item.selected`, `highlighted_links`, and
  `selected_nodes` stale.
- In Vue nodes mode `useNodePointerInteractions` starts a drag on pointerdown
  and again in the multi-select branch of pointermove; the first call is dead
  for that branch.
- `render_only_selected` has no readers; the `nodeSelected`, `groupSelected`,
  and `rerouteSelected` computeds in `canvasStore` are unused.

Since 2025-09 every fix has added a guard to one copy: 10 fix commits in
`LGraphCanvas.ts`, 5 in `useNodePointerInteractions.ts`, 3 in `useNodeDrag.ts`.
Group drag was re-fixed four times and is open again (#15566). Open issues
cluster into state sync (#4743, #4953, #9996, #15697), modifiers (#2890,
#12112, #15028), marquee (#4198, #6450), groups (#4762, #7454), drag versus
click (#3019, #13004, #13144, #15351), and Vue/classic parity (#15287, #15566).
[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md) independently lists selection
leaking into the next workflow as a live bug class.

Existing unit tests for this area assert mock call choreography rather than
resulting selection state, so they pass while the behaviours above are broken.

Mature editors converge on the same shape: tldraw, Excalidraw, Blender, Godot
`GraphEdit`, and Bevy's editor all keep one ordered ID set per document scope
plus a primary ID, keep transient gesture state separate from selection, treat
"selected" and "participates in this drag" as different sets, hold the
container ID for group selection and derive children at the operation, map
modifiers to set/add/subtract/toggle once at the input boundary, and derive
downstream UI without manual synchronisation.

## Decision

Selection becomes one store with command-only mutation, and pointer gestures
become one pure reducer shared by the classic canvas and Vue nodes.

Specifically:

1. A `selectionStore` is the single source of truth. It follows the
   `nodeDataStore`/`rerouteStore` bucketing: `RootGraphId → OwningGraphId →
SelectionState`. `SelectionState` is an insertion-ordered list of branded
   `SelectableKey` values (`kind:id`) with a derived set index; the last key is
   the primary selection. Subgraph navigation and workflow switching change the
   active scope rather than clearing selection. Node removal deletes the key
   from every bucket.
2. All mutation goes through five commands: `selection.replace`,
   `selection.add`, `selection.remove`, `selection.toggle`, and
   `selection.clear`, applied by one pure `reduceSelection(state, command)`
   that returns the next state and `{ status: 'applied' | 'no-op' }`.
   Commands are idempotent, serialisable, and deterministic
   ([ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)). Selection is session
   state: commands are excluded from undo history and CRDT
   ([ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)).
3. Everything else is derived, never stored: `selectedNodes`,
   `selectedGroups`, `primary`, `highlightedLinkIds`, `selectionBounds`,
   `item.selected`, `canvasStore.selectedItems`, toolbox visibility and
   position. `state.selectionChanged`, `updateSelectedItems()`, the three
   copied `highlighted_links` derivations, `render_only_selected`, and the
   unused `canvasStore` computeds are deleted.
4. Modifiers map to commands in exactly one pure function used by click and
   marquee alike: no modifier replaces, Shift adds, Ctrl/Meta toggles, Alt
   subtracts. This changes today's click behaviour, where Shift and Ctrl both
   toggle, to match the marquee and the variable names.
5. Selecting a group selects the group only. Children are a derived query
   (`childrenOf(group)` via the `layoutStore` spatial index) evaluated when an
   operation needs them. Drag participants are a separate transient set
   `expandForDrag(selection, modifiers)`. `groupSelectChildren` becomes an
   option on move, copy, delete, and bounds queries, not a selection cascade.
   `LGraphGroup._children` and `recomputeInsideNodes()` are removed.
6. Pointer input is a pure reducer `reduceGesture(state, event, policy)` over
   `GestureState = idle | pressed | dragging`, returning the next state and a
   list of effects. Hit-testing runs once per `down` and yields a
   `PointerTarget` discriminated union. `pressed → dragging` happens only when
   pointer distance reaches `dragThresholdPx`; crossing the threshold cancels
   the click. `CanvasPointer.bufferTime`, the `onClick`/`onDragStart`/
   `onDrag`/`onDragEnd`/`finally` callback fields, and
   `_processPrimaryButton`/`_processNodeClick`/`_setupNodeSelectionDrag` are
   deleted. Effects are the only code that applies selection commands, layout
   operations, or opens menus.
7. The classic canvas dispatches `hitTest(point)` results into the reducer;
   Vue nodes dispatch DOM pointer events with `target = { kind: 'node', ... }`
   because the DOM already performed the hit test. Groups and reroutes remain
   canvas-hit-tested until Vue components exist for them. Parity between the
   two renderers is structural: `useNodePointerInteractions`,
   `useClickDragGuard`, `hasDraggingStarted`, and
   `layoutStore.isDraggingVueNodes` are deleted and `useNodeDrag` becomes the
   `moveItems` effect.
8. Bring-to-front is an effect of `down` on a node, not of selection. Keyboard
   and marquee selection no longer reorder nodes.
9. Mode flags collapse into one `InteractionPolicy` value (`canSelect`,
   `canDragItems`, `canPan`, `canMarquee`, `canEdit`, `pickOnly`, `emptyDrag`)
   computed from `read_only`, agent picker mode, and title-editor state. Space
   bar and drag-zoom set a temporary override inside `GestureState`; they do
   not write `read_only`.
10. Extension surfaces survive as adapters over the store: `canvas.selectedItems`
    (read-only live view), `canvas.selected_nodes` (deprecated getter via
    `defineDeprecatedProperty`), `canvas.onSelectionChange`,
    `canvas.onNodeSelected`/`onNodeDeselected`, `node.onSelected`/`onDeselected`,
    the `item.selected` getter, and `selectNode`/`selectNodes`/`selectItems`/
    `deselect`/`deselectAll`/`processSelect` as thin command emitters. Raw
    writes to `item.selected` or `selectedItems` are rejected in development
    and logged; the custom-node corpus is searched for such writes before the
    setters are removed.
11. Selection changes request a foreground draw with reason
    `interaction/selection` ([ADR-RENDERING-INVALIDATION-0021](RENDERING-INVALIDATION-0021-classified-frame-coalesced-canvas-invalidation.md)).
12. Tests drive the real `LGraphCanvas`, `reduceGesture`, and `selectionStore`
    through a table over `{plain, shift, ctrl, alt} × {click, marquee, drag,
right-click, group title, nested group} × {classic, vue}` and assert store
    state, derived getters, hook call counts, and z-order. Mock-choreography
    suites for this area are deleted.

## Alternatives Considered

- **Expand group selection into child IDs (Excalidraw).** Simpler queries, but
  it is the source of the current stale-children defects: every operation that
  changes selection must know which children came from which group, and
  toggling the group off requires un-cascading. Holding the container ID and
  deriving children matches tldraw, Blender, and Godot and removes the
  re-fixed group-drag chain.
- **Per-item `selected` flag as the canonical store (React Flow).** Keeps
  `item.selected` authoritative and avoids a new store, but leaves no ordered
  set, no primary item, no scope per graph, and no place to hang link
  highlighting; it is what the code has today with the mirrors added on top.
- **Keep `CanvasPointer` callbacks and add guards.** Lowest immediate cost. It
  is also the strategy of the last twelve months of fixes, and each fix added a
  flag (`sticky`, `block_click`, `dragGuard`, `hasDraggingStarted`) whose
  interaction with the others is untested.
- **Keep time-based drag promotion (`bufferTime`).** Lets a long press become a
  drag without movement. It is the direct cause of the slow-click-becomes-drag
  class of issues and no surveyed editor uses it; a pixel threshold is
  sufficient.
- **Separate reducers for classic and Vue nodes.** Keeps the Vue path free of
  litegraph types, but parity then depends on tests rather than structure, and
  the two paths have already diverged on modifiers and double drag-start.
- **Put selection under undo/CRDT.** Requested in #4757 as optional
  serialisation. Undoing a selection change is not what users expect from
  Ctrl+Z, and ADR-GRAPH-DOCUMENT-0026 classifies selection as ephemeral. A snapshot can be
  layered on the store later if needed.
- **Hard-break the extension API immediately.** Would delete the deprecated
  surfaces in one step, but `selected_nodes` and `onSelectionChange` are read
  by the custom-node ecosystem ([AGENTS.md](../../AGENTS.md) constraint 5).
  Adapters cost little once the store exists.

## Consequences

### Positive

- One reader per selection fact; `item.selected`, link highlighting, toolbox,
  and Vue node styling cannot disagree with each other or with the store.
- Modifier semantics are a table in one function; a bug fix there fixes click
  and marquee in both renderers at once.
- Drag-versus-click is a deterministic function of pointer distance, testable
  without timers.
- Group drag, group toggle, and nested-group hooks become one query and one
  hook path instead of four re-fixed special cases.
- Selection scoping per owning graph removes the destroyed-node leak across
  workflows and subgraphs named in ADR-GRAPH-DOCUMENT-0026.
- Test coverage shifts from mock call order to observable state, so the tests
  fail when the behaviour breaks.

### Negative

- Shift-click changes from toggle to add. Users who rely on Shift-click to
  deselect must use Ctrl/Meta-click; this needs a release note.
- Extensions that write `item.selected` or mutate `canvas.selectedItems`
  directly stop having an effect and receive a development warning; migration
  guidance is required.
- Long-press-to-drag without movement no longer exists; touch and pen users
  must move past the threshold.
- Migration spans roughly nine focused pull requests; during that window
  write-through adapters keep both old and new state live, temporarily adding
  code rather than removing it.
- The gesture reducer introduces a discriminated-union state machine into code
  that currently uses imperative callbacks; contributors need the
  [state-and-effects guidance](../guidance/state-and-effects.md) to work in it.

## Notes

Tracking: [FE-2040](https://linear.app/comfyorg/issue/FE-2040). Investigation
thread with executed hypothesis tests:
[T-01a06d2f](https://ampcode.com/threads/T-01a06d2f-2dce-700c-925b-4453696769e4).

Related decisions: [ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md) (command
pattern and layout store), [ADR-ECS-0008](ECS-0008-entity-component-system.md) (stores
over instance state, plain-data components),
[ADR-RENDERING-INVALIDATION-0021](RENDERING-INVALIDATION-0021-classified-frame-coalesced-canvas-invalidation.md) (invalidation
reasons), [ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md) (selection as
per-document session state).

Planned migration order, each step under 300 non-test lines: real-canvas test
harness and dead-code removal; `selectionStore` with write-through from
`select`/`deselect`/`deselectAll`; derive `highlighted_links` and
`selected_nodes`; single modifier resolver; group semantics; gesture reducer
for the classic canvas; gesture reducer for Vue nodes; `InteractionPolicy`;
deprecations and documentation.
