# Output Slot Connectivity

Date: 2026-07-06
Status: Proposed (follow-up to the
[link topology store](link-topology-store.md); the minimal, non-breaking
slice of the deferred `SlotConnection` component work in the
[ECS migration plan](ecs-migration-plan.md))

Design record for answering "is this output slot connected, and by what
links?" from `linkStore` instead of the `output.links[]` mirror. It is
the output-side counterpart to the input-side migration shipped in
[node-data-store Decision 3](node-data-store.md) (#13455). Wiring it lets
`SlotConnectionDot` show connected state and removes the last renderer
dependency on `output.links[]`.

This phase does not extract a Slot entity, add a store, or delete any
mirror field. Those stay in the deferred `SlotConnection` phase. What it
does is the smallest change that clears the reader debt and lets the
output dot show connection state.

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

## Decision 2: Output connectivity is a derived reverse index

The store already exposes `graphTopologies(graphId)` over every
registered `LinkTopology`. "Which links leave output slot _(node, slot)_"
is a reverse index over origin endpoints. This is the same pattern
`rerouteStore` uses for link membership
([reroute store](reroute-chain-store.md)): a per-graph cached `computed`
that Vue invalidates when link state changes. Nothing is stored, so the
membership is always derived and cannot drift from the topology.

```ts
type OriginIndex = Map<
  string /* `${originNodeId}:${originSlot}` */,
  Set<LinkId>
>

const outputIndexes = new Map<UUID, ComputedRef<OriginIndex>>()

function outputIndex(graphId: UUID): ComputedRef<OriginIndex> {
  const existing = outputIndexes.get(graphId)
  if (existing) return existing
  const next = computed(() => {
    const index: OriginIndex = new Map()
    for (const t of graphTopologies(graphId)) {
      if (t.originNodeId === UNASSIGNED_NODE_ID) continue
      const key = originKey(t.originNodeId, t.originSlot)
      ;(index.get(key) ?? index.set(key, new Set()).get(key)!).add(t.id)
    }
    return index
  })
  outputIndexes.set(graphId, next)
  return next
}
```

The index spans both collections that `graphTopologies` yields, the keyed
targets and the unkeyed side set, so a floating link with an assigned
origin (one endpoint only) still reports its output as connected. A
`SUBGRAPH_INPUT_ID` origin indexes like any other id.

## Decision 3: Two public queries, mirroring the input pair

```ts
isOutputSlotConnected(graphId, nodeId, slot): boolean
getOutputSlotLinks(graphId, nodeId, slot): ReadonlySet<LinkId>
```

These match `isInputSlotConnected` / `getInputSlotLink` in name and shape.
The input side returns a single `LinkTopology`, since at most one link
targets an input; the output side returns a set, since an output fans out
to many. Presence is all the renderer needs, and `getOutputSlotLinks`
covers the readers that currently iterate `output.links`.

## Decision 4: Migrate readers incrementally, keep the mirror written by hand

This follows the #13455 discipline for `input.link`: move the readers to
the store, leave the field in place, and keep writing it at the
chokepoints.

`output.links[]` has roughly 200 read sites but only about 12 write
sites, all in `LGraphNode`, `LGraph`, and the subgraph paths. Most of the
reads are litegraph-internal graph algorithms such as traversal, dedup,
and serialization. Those can keep reading the mirror indefinitely; they
are not renderer policy and nothing blocks on them. This phase migrates
only the reader that drives the payoff, the output dot's connected state,
plus any renderer or pricing reader that needs mere presence. Migrating
the rest is opportunistic follow-up rather than a gate.

Because the mirror field stays written and readable, no extension breaks.
Deleting `output.links[]` and `input.link` is an extension-visible change
to litegraph-native surfaces (the 40+ custom-node-repo rule in
AGENTS.md), so it is a later step, not this one.

## Decision 5: Wire connected state into the dots (the payoff)

`NodeSlots.vue` passes `connected` to each slot:

- input: `linkStore.isInputSlotConnected(rootGraphId, nodeId, index)`
  (already available)
- output: `linkStore.isOutputSlotConnected(rootGraphId, nodeId, index)`
  (Decision 3)

`InputSlot` and `OutputSlot` already forward `connected` to the
`lg-slot--connected` class. `SlotConnectionDot` needs no prop of its own:
the wrapper class is an ancestor styling hook
(`.lg-slot--connected .slot-dot`), so the visual is one CSS rule away once
the design-standards check (open question 3) picks it. Threading a
`connected` prop into the dot before that would be plumbing with no
consumer. `compatible` stays driven by the existing drag state
(`useSlotLinkDragUIState`), which this phase leaves alone.

## Scope

In scope: the derived output-side index, the two queries, the output-dot
reader migration, and wiring `connected` from `NodeSlots` into
`InputSlot` / `OutputSlot` (whose `lg-slot--connected` class reaches the
dot via CSS).

Out of scope, each a piece of the deferred `SlotConnection` phase:

- Deleting the `input.link` / `output.links` mirror fields. This is
  extension-breaking and needs migration guidance.
- Removing the `output.links` write sites at the chokepoints.
- Migrating the remaining ~200 `output.links` readers.
- Slot entity extraction: `SlotIdentity`, `SlotVisual`, and retiring the
  `NodeInputSlot` / `NodeOutputSlot` class instances and their
  `shallowReactive` graft.
- A `compatible`-state source beyond the current drag UI state.

## Open questions

1. **Index granularity.** One `computed` per graph rebuilds the whole
   origin index on any link change in that graph, the same cost model as
   `rerouteStore`. If profiling on large graphs shows this is hot, the
   fallback is an incrementally maintained `Map` updated in `place` and
   `displace`, which is more code and carries drift risk. Start with the
   derived version and measure before optimizing.
2. **Return type of `getOutputSlotLinks`.** `ReadonlySet<LinkId>` is
   cheap and gives presence plus ids; `LinkTopology[]` would match
   `getInputSlotLink`, which returns topology. Ids suffice for every
   reader found so far, so prefer the set unless a consumer needs
   endpoints.
3. **Dot visual.** What "connected" looks like on the dot (fill, ring, or
   opacity) is a design-standards question rather than an architecture
   one. Check the Comfy Design Standards before implementing Decision 5.
