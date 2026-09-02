# ADR-SLOTS: Slot Records as the Source of Truth

Date: 2026-08-24

## Status

Accepted

## Context

The ECS migration moved node shell state, widget values, link topology, and
reroute chains into stores. Slot metadata is the remaining exception.

Today:

- `NodeState.inputs` and `NodeState.outputs` contain `INodeInputSlot` and
  `INodeOutputSlot` class instances.
- The arrays are store-held, but fields such as name, type, geometry, and flags
  live on those class instances. Slots have no records, store, or IDs.
- Link connectivity already lives in `linkStore`. The deprecated `input.link`
  and `output.links` accessors derive their values from that store.

PR #15544 explores descriptors and Proxy-backed arrays as compatibility layers.
Those layers may change how extensions access slots, but they do not answer
which representation owns the data during the migration. This ADR establishes
one source of truth.

## Decision

Each slot will eventually have an ID-keyed record in a store. That record will
own the slot's state.

`LGraphNode.inputs`, `LGraphNode.outputs`, descriptors, Proxies, and
extension-facing slot objects may remain during the migration. Once a slot
field moves into a store record, every compatibility view must read and write
that record rather than keep separate state.

The current class-owned state is a temporary exception recorded in
`docs/exceptions-log.md`. The exception closes when store records own slot state
and the class-owned arrays and any descriptor or Proxy layer have been removed.

PR #15779 adds a stable Proxy around `LGraphNode.inputs` as an interim
compatibility view. It converts plain slots assigned through numeric writes
into `NodeInputSlot` instances without becoming a new source of truth. Once
ID-keyed records land, the view must project those records and the Proxy must be
removed with the class-owned arrays after compatibility coverage is in place.

We will introduce slot records when implementation work can replace the current
representations. We will not add them only to make the code resemble an
abstract ECS model.

### Slot keys

This ADR does not choose between structural keys, such as
`graphId:nodeId:direction:index`, and minted IDs. Structural keys make reuse
straightforward but must account for slot renames and reordering. Minted IDs
need explicit collision and reminting behavior.

The implementation that chooses the key format must document its collision
behavior in ADR-ECS and test it in
`src/stores/storeCollisionContracts.test.ts`.

## Migration path

1. Keep the current slot classes and extension API while the exception is open.
2. Move each migrated slot field into store state. Compatibility objects must
   read and write that state.
3. Add ID-keyed slot records, migrate readers and writers, and test the chosen
   collision behavior.
4. Remove the class-owned arrays and any descriptor or Proxy layer after
   ecosystem tests cover indexed access, array mutations, reflection, and
   stable slot identity.

## Consequences

- Slot metadata will have one source of truth, consistent with other migrated
  entity state.
- Extensions can keep using slot arrays while the migration is in progress.
- Compatibility behavior must be tested before either interim representation
  is removed.
- The slot key format remains undecided until the implementation has enough
  information to choose it.

## References

- ADR-ECS, "Entity Component System"
- `docs/architecture/output-slot-connectivity.md`
- `docs/architecture/node-data-store.md`
- `docs/exceptions-log.md`
- PR #14246, ECS migration
- PR #15544, descriptor and Proxy boundary proposal
- PR #15779, interim input-slot compatibility Proxy
