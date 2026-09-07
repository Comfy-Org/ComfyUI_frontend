# ADR-CANVAS-SELECTION-0028: Single Selection Store

Date: 2026-09-04

## Status

Proposed

## Context

Selection of nodes, groups, reroutes, and subgraph IO nodes has no single
owner. The fact "node 7 is selected" is stored in `item.selected`,
`canvas.selectedItems`, the deprecated `canvas.selected_nodes`,
and the Vue mirror `canvasStore.selectedItems`. Link highlighting and the
`state.selectionChanged` pulse are maintained alongside those copies.

Callers must update these values in the right order. Fifteen external call
sites manually call `updateSelectedItems()` to synchronize the Vue mirror.
Direct mutations, such as `selectedItems.clear()`, can leave `item.selected`,
`highlighted_links`, and `selected_nodes` stale.

Selection behavior is also spread across classic canvas and Vue input paths.
Those paths differ in modifier handling, group selection, callback emission,
and click-versus-drag handling. Changing those behaviors while moving their
state would make it difficult to tell whether a regression came from the state
migration or from a new interaction policy.

This ADR therefore addresses state ownership only. Existing interaction
behavior remains in place until it can be changed and reviewed separately.

## Decision

Selection becomes graph-scoped session state owned by one `selectionStore`.
The existing canvas and Vue interaction paths use the store without changing
their user-visible behavior.

Specifically:

1. The store follows the existing `RootGraphId → OwningGraphId` bucketing used
   by graph-scoped stores. Each bucket contains an insertion-ordered list of
   `SelectableKey` values. A key identifies a node, group, reroute, subgraph
   input node, or subgraph output node.
2. Entity removal carries its full graph scope and removes the corresponding
   key only from that bucket. An entity removal must not affect a different
   graph that happens to reuse the same local ID. Workflow switches and
   subgraph navigation clear the outgoing selection as they do today; returning
   to a graph does not restore its previous selection. Buckets define identity
   and cleanup scope, not navigation history. Closing a root graph evicts all
   of its buckets.
3. State changes use four commands: `selection.replace`, `selection.add`,
   `selection.remove`, and `selection.clear`. The commands are serializable,
   deterministic, and idempotent. Every command identifies its root and owning
   graph. `replace` carries an ordered list of keys, `add` and `remove` carry one
   key, and `clear` clears only the addressed owning-graph bucket. Closing a
   root graph evicts its buckets through store lifecycle cleanup rather than a
   broader form of `clear`. Repeated `add` does not duplicate or reorder a key;
   `replace` keeps the first occurrence of each key; removing an absent key and
   clearing an empty bucket are no-ops. Existing toggle interactions inspect
   current membership and issue either `add` or `remove`; there is no
   replay-sensitive `selection.toggle` command. Selection remains outside undo
   history and CRDT synchronization because it is session state.
4. `canvas.selectedItems`, `canvas.selected_nodes`,
   `canvas.highlighted_links`, `item.selected`, and `canvasStore.selectedItems`
   become views or compatibility adapters over the store. Keys resolve through
   the addressed owning graph and iteration returns its canonical live entity
   objects, preserving object identity and the current group-and-child contents.
   Removal drops the key before the ID can be reused, so a new entity with the
   same local ID does not inherit selection; unresolved keys are omitted rather
   than exposing stale objects. `selectedItems.add`, `delete`, and `clear`
   dispatch the corresponding scoped commands and retain their current `Set`
   return values. Assigning `true` to `item.selected` dispatches `add`; assigning
   `false` or `undefined` dispatches `remove`. These raw compatibility writes do
   not add callback effects that they do not emit today. `selected_nodes`,
   `highlighted_links`, and `canvasStore.selectedItems` retain their current
   projection shapes. If an extension writes one of those projections without
   changing selection today, the adapter preserves that value separately and
   does not treat it as selected state. Removing that writable behavior requires
   a separate deprecation. Interaction focus fields such as `canvas.current_node`
   and `canvas.selected_group` remain separate.
5. Existing methods remain the behavior boundary. `select`, `deselect`,
   `deselectAll`, `processSelect`, `selectNode`, `selectNodes`, and
   `selectItems` translate their current decisions into store commands. They
   continue to emit `onSelectionChange`, node selection hooks, redraw requests,
   and z-order changes at their current points and with their current call
   counts. A state command does not emit hooks by itself.
6. Group selection keeps `groupSelectChildren`, `LGraphGroup._children`, and
   `recomputeInsideNodes()` unchanged. The store records the resulting selected
   items rather than introducing new group semantics during this migration.
7. Pointer handling stays unchanged. `CanvasPointer`,
   `Comfy.Pointer.ClickBufferTime`, `useClickDragGuard`, classic and Vue gesture
   paths, `canvas.selectOnly`, and current modifier mappings are outside this
   decision.
8. Selection changes continue to request the same redraws they request today.
   Adopting a classified `interaction/selection` invalidation reason belongs in
   the rendering-invalidation work.

### Compatibility requirements

The migration must preserve these observable behaviors:

- Plain, modified, empty-canvas, marquee, right-click, and drag interactions
  keep their current classic and Vue behavior, including existing differences.
- Agent picker mode keeps node-only accumulation, empty-canvas preservation,
  and its current edit and drag guards through `canvas.selectOnly`.
- Alt keeps its current node-clone and link-reroute bindings.
- Group selection and deselection keep their current child-cascade behavior.
- Workflow switches and subgraph navigation clear selection rather than
  restoring a selection retained for that graph.
- Selection callbacks and node hooks keep their current entry-point-specific
  emission behavior.
- Extension reads and writes through documented or observed legacy selection
  paths continue to work until separately deprecated.

Characterization tests against the real `LGraphCanvas` record these contracts
before each caller moves to the store. Store tests cover command idempotence,
scope, duplicate-free insertion order, removal of every selectable kind,
graph-scoped cleanup, navigation clearing, and root-graph eviction. Adapter
tests cover `Set` mutator return values, canonical object identity,
group-and-child contents, and removal followed by same-ID recreation. Each
migration step must leave the characterization tests unchanged.

### Deferred decisions

The following work requires separate decisions because it changes behavior or
public compatibility. The proposed
[ADR-CANVAS-GESTURE-0029](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17106)
owns the pointer gesture changes:

- unifying classic and Vue gesture handling;
- changing modifier meanings or combined-modifier precedence;
- replacing the click buffer with a distance-only drag threshold;
- changing group selection to store only the group ID;
- changing callback emission rules;
- replacing `canvas.selectOnly` with an interaction policy; and
- removing writable extension selection APIs.

## Alternatives considered

- **Migrate state and gestures together.** This could remove more code at once,
  but it combines state, input, extension, and behavior changes in one
  migration. A regression would be harder to isolate.
- **Keep `item.selected` canonical.** This avoids a store but leaves selection
  distributed across object flags, canvas collections, Vue state, and link
  highlighting. It also does not solve graph scoping.
- **Replace every selection path in one change.** This shortens the transition
  but increases extension risk and makes callback compatibility difficult to
  verify. Small migrations guarded by the same characterization tests are
  easier to review.

## Consequences

### Positive

- Selection has one graph-scoped owner.
- Derived canvas, Vue, and highlighting state cannot drift from the selected
  key set.
- Entity cleanup cannot remove selection in an unrelated graph with the same
  local ID.
- Later interaction changes start from consistent state and can be reviewed as
  behavior changes rather than mixed migrations.

### Negative

- Compatibility adapters temporarily retain some legacy APIs and code paths.
- Existing interaction inconsistencies remain until follow-up decisions address
  them.
- Characterization tests preserve behavior that may later be intentionally
  changed.

## Notes

Tracking: [FE-2040](https://linear.app/comfyorg/issue/FE-2040).

Related decisions:
[ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
provides the serializable-operation precedent;
[ADR-ECS-0008](ECS-0008-entity-component-system.md) places entity state in
dedicated stores; and
[ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
classifies selection as graph-scoped session state.

Planned migration order:

1. Add real-canvas characterization tests and inventory first-party and
   extension-facing writes.
2. Add `selectionStore`, command tests, cleanup tests, and compatibility
   adapters.
3. Migrate first-party canvas and Vue readers and writers one path at a time.
4. Derive highlighting and legacy views from the store, then remove redundant
   mirrors whose compatibility checks are complete.
