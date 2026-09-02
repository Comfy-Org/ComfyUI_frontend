# Output Slot Connectivity

Date: 2026-07-06
Status: Accepted; follow-up to the
[link topology store](link-topology-store.md); the minimal, non-breaking
slice of the deferred `SlotConnection` component work in the
[ECS migration plan](ecs/ecs-migration-plan.md)

Design record for answering "is this output slot connected, and by what
links?" from `linkStore` instead of the `output.links[]` mirror. It is
the output-side counterpart to the input-side migration shipped in
[node-data-store Decision 3](node-data-store.md) (#13455). Wiring it lets
`SlotConnectionDot` show connected state and removes the last renderer
dependency on `output.links[]`.

This phase did not extract a Slot entity or add a store. It ultimately deleted
the mutable connectivity mirrors while retaining deprecated, read-only
compatibility accessors; Decision 6 records the shipped result.

## Motivation

`SlotConnectionDot.vue` colors slots by type only. It carries a
`//TODO Support connected/disconnected colors?`. `InputSlot` and
`OutputSlot` already declare `connected` / `compatible` props and apply
the `lg-slot--connected` / `lg-slot--compatible` classes, but
`NodeSlots.vue` passes neither, so the styling path is built but unwired.

Input connectivity is already answerable through
`linkStore.isInputSlotConnected` (shipped in #13455). The matching output
query does not exist yet, so the output dot cannot be wired and
`output.links[]` stays the only source. This phase adds that query and
consumes it.

## Decision 1: Extend `linkStore`, do not add a store or a Slot entity

Output connectivity is link topology: the mirror image of the input side
the store already owns. It belongs in `linkStore`, not a new `slotStore`.
A dedicated Slot store (plain `SlotIdentity` / `SlotVisual` rows, retiring
the slot class instances) is the full `SlotConnection` phase and is out
of scope here. Introducing it now would be premature per the
node-data-store record, which keeps the slot arrays class-side.

This phase adds read-only accessors over state the store already holds.
It needs no new plain-data component, registration trio, chokepoint, or
class adoption, though each sibling store required all four.

## Historical decision 2: do not derive a reverse index on demand

The initial design built a cached `computed` index by scanning every topology.
It was not shipped. The implemented
[`linkStore`](../../src/stores/linkStore.ts) maintains `originIndex` atomically
with topology changes, and `getOutputSlotLinks` reads it directly. Floating
links are not indexed.

## Decision 3: Two public queries, mirroring the input pair

```ts
isOutputSlotConnected(scope: GraphScope, nodeId, slot): boolean
getOutputSlotLinks(scope: GraphScope, nodeId, slot): ReadonlySet<LinkTopology>
```

These match `isInputSlotConnected` / `getInputSlotLink` in name and shape.
The input side returns a single `LinkTopology`, since at most one link targets
an input; the output side returns a set, since an output fans out to many. The
set holds topologies rather than bare `LinkId`s because readers need endpoints,
and because `graph.links` deliberately exposes only fully-assigned links.
Floating and fully-assigned links share one root-wide ID namespace and topology
collection; endpoint state determines which compatibility view and indexes
expose them.

## Historical decision 4: migrate readers while writing the mirror

This bridge was superseded by Decision 6. It is retained only to explain the
incremental rollout.

This follows the #13455 discipline for `input.link`: move the readers to
the store, leave the field in place, and keep writing it at the
chokepoints.

`output.links[]` has roughly 200 read sites but only about 12 write
sites, all in `LGraphNode`, `LGraph`, and the subgraph paths. Most of the
reads are litegraph-internal graph algorithms such as traversal, dedup,
and serialization. Those can keep reading the mirror indefinitely; they
are not renderer policy and nothing blocks on them.

Migrated readers: the output dot's connected state (`NodeSlots`), the
minimap link extraction (`MinimapDataSource`), the drag-start
disconnect check (`useSlotLinkInteraction`, where one store query replaces
a mirror read plus a `slotFloatingLinks` scan), widget value propagation
(`widgetValuePropagation`), and matchType link revalidation
(`dynamicWidgets.changeOutputType`).

## Decision 5: Wire connected state into the dots (the payoff)

`NodeSlots.vue` passes `connected` to each slot:

- input: `linkStore.isInputSlotConnected(graphScopeOf(graph), nodeId, index)`
  (already available)
- output: `linkStore.isOutputSlotConnected(graphScopeOf(graph), nodeId, index)`
  (Decision 3)

`InputSlot` and `OutputSlot` already forward `connected` to the
`lg-slot--connected` class. `SlotConnectionDot` needs no prop of its own:
the wrapper class is an ancestor styling hook
(`.lg-slot--connected .slot-dot`), so the visual is one CSS rule away once
the design-standards check (open question 3) picks it. Threading a
`connected` prop into the dot before that would be plumbing with no
consumer. `compatible` stays driven by the existing drag state
(`useSlotLinkDragUIState`), which this phase leaves alone.

## Decision 6: Delete the mirrors (implemented; extended to `input.link`)

The runtime `output.links[]` field and all nine of its write sites are
deleted. The same recipe has since been applied to `input.link`: the
field is a deprecated warning getter, litegraph and app code read through
the slotLinks input helpers (`inputHasLink`, `inputLinkId`, `inputLink`)
or `node.isInputConnected` / `node.getInputLink`, serialization derives
`inputs[].link` from the store, and the mirror-carried association
shuffles were reworked — `LGraph.configure()` realigns serialized input
slots through `realignInputLinkSlots`, dynamicWidgets' group rebuilds carry
slot→link association
in a module-scoped WeakMap refreshed from the store, and link
deduplication selects survivors from the store registration (the
`repairInputLinks` mirror repair is gone; the derived view cannot be
wrong). The store is the single source; litegraph internals read through
the pure helpers in `node/slotLinks.ts` (`outputHasLinks`,
`outputLinkIds`, `outputLinks`), and `NodeOutputSlot.isConnected`,
`serialize`, and `configure` derive from the store. Details:

- **Wire format unchanged.** `outputAsSerialisable` / `toJSON` emit the
  serialized `outputs[].links` array from the store, sorted ascending by
  id (a determinism choice — equal to push order for organically built
  graphs) and `null` when empty. `configure` fires its output
  `onConnectionsChange` callbacks from the serialized argument.
- **Floating links are never returned by link queries.** They are
  reroute-chain scaffolding, named by `isFloatingTopology`
  (`src/types/linkTopology.ts`). `isOutputSlotConnected` /
  `getOutputSlotLinks` see fully-assigned links only, matching the
  mirror they replace; the one consumer with legacy floating-aware
  behavior (the slot-drag disconnect check) keeps its own
  `slotFloatingLinks` scan.
- **Extension compat = deprecation telemetry, not compatibility.** A
  read-only prototype getter on `NodeOutputSlot` returns a fresh
  store-derived `LinkId[] | null` and fires `warnDeprecated`. Writes fire
  their own `warnDeprecated` naming the replacement APIs
  (`node.connect()` / `node.disconnectOutput()`) and are otherwise
  ignored — the store stays authoritative and legacy writers degrade
  gracefully instead of crashing. A bare accessor-only property would
  instead throw an unactionable `TypeError` in strict mode.
  `INodeOutputSlot` keeps `links` as `@deprecated readonly` so
  `'links' in slot` discriminants still compile and hold at runtime via
  the prototype. The mirror keys are non-enumerable: `{ ...slot }`,
  `Object.assign({}, slot)`, and `Object.keys(slot)` do not carry
  `link` / `links` (use the store queries to snapshot connectivity);
  `JSON.stringify` still emits them via `toJSON`. `addInput` / `addOutput`
  drop a stale `link` / `links` key from `extra_info` instead of letting
  `Object.assign` collide with the accessor — the store is not consulted
  or mutated by such values.
- **Duck-typed slots are upgraded in place.** `_setConcreteSlots` writes
  the concrete `NodeInputSlot` / `NodeOutputSlot` wrappers back into
  `node.inputs` / `node.outputs`. The concrete classes resolve their slot
  index by identity (`inputs.indexOf(this)`), so a wrapper that is not
  the array entry would permanently read as disconnected. Plain-object
  slots pushed directly into the arrays are therefore upgraded at the
  next concretisation (`configure`, paste/convert paths, every canvas
  draw); until then their stale `link` value is dead data. Extensions
  should use `node.addInput()` / `node.addOutput()` instead of pushing
  literals.
- **Serialized-data operators are untouched.** `linkFixer` (serialized
  branch), `migrateReroute`, and `unpackSubgraph`'s pre-configure strip
  operate on the wire format, which still carries `links`.
- **Behavior changes, deliberate:** `PrimitiveNode.onLastDisconnect`
  fires on disconnect-all (the stale mirror previously suppressed it);
  `disconnectInput` passes `link_info.origin_slot` — not the old
  mirror-array index — as the OUTPUT slot in `onConnectionsChange`;
  serialization emits `null` where a lingering `[]` used to persist.

Extension migration map: presence → `node.isOutputConnected(slot)` /
`slot.isConnected`; enumerate targets → `node.getOutputNodes(slot)`;
enumerate links → `outputLinks(graph, node.id, slot)` / `outputLinkIds`
(`node/slotLinks.ts`); mutate → `node.connect(...)` /
`node.disconnectOutput(slot, target?)`. App/Vue code uses
`useLinkStore().getOutputSlotLinks(...)` (reactive).

## Scope

In scope: the maintained output-side index, the two queries, the output-dot
reader migration, and wiring `connected` from `NodeSlots` into
`InputSlot` / `OutputSlot` (whose `lg-slot--connected` class reaches the
dot via CSS).

Since implemented by Decision 6: `output.links` reader migration, write
sites, and field deletion — and the same for `input.link` (PR 13498).

Out of scope, each a piece of the deferred `SlotConnection` phase:

- Slot entity extraction: `SlotIdentity`, `SlotVisual`, and retiring the
  `NodeInputSlot` / `NodeOutputSlot` class instances and their
  `shallowReactive` graft.
- A `compatible`-state source beyond the current drag UI state.
- Floating/regular link-id counter unification (mint floating ids from
  the shared `state.lastLinkId`) — only if the internal wart ever bites;
  nothing resolves store-returned ids against `graph.links` across the
  id spaces anymore.

## Historical open questions

1. **Index granularity. Resolved:** the store maintains `originIndex`
   atomically with topology and target occupancy. The earlier one-computed-per-
   graph design is retained above as historical context.
2. **Return type of `getOutputSlotLinks`.** Resolved: a set of
   `LinkTopology`, per Decision 3. Bare ids looked sufficient until the
   reader migration surfaced both the endpoint needs (minimap, widget
   value propagation) and the floating-id collision hazard.
3. **Dot visual.** What "connected" looks like on the dot (fill, ring, or
   opacity) is a design-standards question rather than an architecture
   one. Check the Comfy Design Standards before implementing Decision 5.
