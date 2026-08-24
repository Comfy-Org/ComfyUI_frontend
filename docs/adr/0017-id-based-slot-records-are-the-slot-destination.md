# 17. ID-Based Slot Records Are the Slot Destination

Date: 2026-08-24

## Status

Accepted

Decided by Christian Byrne on 2026-08-24 (program decision D-dq-08, option A),
conditional on three artifacts: this ADR, full documentation of the current
transitional state, and an entry in the central repo exceptions log
(`docs/exceptions-log.md`). The transitional-state documentation lives in the
Context section below; the exceptions-log entry lands as a companion change.

## Context

The ECS migration (#14246, ADR-0008) moved node shell state, widget values,
link topology, and reroute chains into stores. Slots are the one remaining
component family whose live state is still owned by class instances — the
"class-owned component fields" retirement item.

### Current state (verified at main `a8abe573c0`)

- `NodeState.inputs` / `NodeState.outputs` are `shallowReactive` arrays of
  `INodeInputSlot` / `INodeOutputSlot` **class instances**
  (`src/types/nodeState.ts`, `createNodeShellState` in
  `src/core/graph/nodeShell/nodeShellState.ts`).
- `LGraphNode.inputs` is a getter over the store proxy's `_state.inputs`
  (`src/lib/litegraph/src/LGraphNode.ts`). The array **container** is
  store-held, but every slot **field** (name, type, geometry, flags) lives on
  the class instance the array points at. There is no slot record, no slot
  store, and no slot id.
- Link **connectivity** is already store-owned: `linkStore` answers
  "is this slot connected, and by what links"; the mutable `input.link` /
  `output.links` mirrors were deleted, leaving deprecated read-only
  compatibility accessors (see
  `docs/architecture/output-slot-connectivity.md`). Slot entity extraction
  (`SlotIdentity` / `SlotVisual` rows, retiring the class instances and their
  `shallowReactive` graft) was explicitly deferred there as the
  `SlotConnection` phase: "Introducing it now would be premature."

### The ambiguity this ADR resolves

PR #15544 proposes flipping `NodeState` slot arrays from class instances to
plain descriptors, with a Proxy virtual array projecting descriptors back to
class instances at the extension boundary. Its own structural follow-up plan
(slice 1) then proposes restoring **real slot-class arrays** at the extension
boundary, deriving descriptors at the node-state boundary "until a complete
ID-based slot record can replace both representations." Both representations
are named as interim, but slice 1 does not say which side is _authoritative_
during the interim — and "keep real slot-class arrays, derive descriptors
from them" reads as class arrays owning live state again, which is exactly
the state the retirement item exists to end.

## Decision

**ID-based slot records in stores are the destination for slot state.
Slot-class arrays — and any descriptor or Proxy projection of them — are
derived views over store state, never owners.**

Three rules follow:

1. **Authority direction is one-way.** Once a slot field's source of truth
   moves into a store record, no later change may make a class instance or a
   boundary projection authoritative over it again. During any interim step
   (including a #15544-style compat boundary), views must read from and write
   through store state; a change that reverses that direction is a regression,
   not a judgment call.
2. **The current class-instance ownership is a known, bounded exception, not
   an accepted end state.** It is recorded in the central exceptions log
   (`docs/exceptions-log.md`) with an owner and an exit condition: the
   exception closes when slot records own slot state and both interim
   representations (class-instance `NodeState` arrays, and any
   descriptor/Proxy boundary layer) are retired.
3. **Slot records are introduced for function, not form.** The repo's
   retirement ledger explicitly rules out "slot IDs or component stores
   created solely to match an abstract ECS model." A slot record lands when
   it replaces both interim representations and retires the authority
   ambiguity — carried by work that needs it, not as a purity refactor.

### Deliberately not decided here: the slot key scheme

Whether slot ids are **structural** (derived from position, e.g.
`graphId:nodeId:direction:index` or `:name`, like `WidgetId`) or **minted**
(app-issued counters, like `NodeId` / `LinkId`) is left to the PR that
introduces the record. The choice is consequential: per ADR-0008's
"Amendment (2026-08-23): registration and collision contract," the key kind
determines the collision family — structural keys resolve-and-reuse, minted
identity keys reject-or-remint. Widget re-mint semantics (values surviving
node replacement) suggest slots share the structural family, but slot
reordering and renaming complicate positional keys. That analysis belongs
with the implementation; whichever kind is chosen, the collision contract
must be added to ADR-0008's amendment and pinned in
`src/stores/storeCollisionContracts.test.ts`.

## Migration path

1. **Now (interim).** Class instances remain the live slot state; the
   extension-visible surface is unchanged; the exceptions-log entry is open.
2. **Boundary compat step (#15544 family, if it proceeds).** The
   extension-visible arrays stay real slot-class arrays for ecosystem
   compatibility, but as _views_: descriptors derived at the node-state
   boundary, mutations flowing through store state. Rule 1 applies from the
   moment any slot field moves store-side.
3. **Slot record introduction.** The deferred `SlotConnection` phase:
   `SlotIdentity` / `SlotVisual` (or equivalent) rows in a store, readers and
   writers migrated, collision contract recorded and tested.
4. **Retirement.** Remove the descriptor/Proxy boundary layer (if it landed)
   and the class-instance `NodeState` arrays once ecosystem tests cover
   indexed access, mutation methods, reflection, and stable slot identity.
   Closing this step ticks the "class-owned component fields" retirement item
   and closes the exceptions-log entry.

## Consequences

- Slot authority becomes consistent with every other migrated component
  family: stores own state, classes and projections are views. Reviews gain a
  bright-line rule for slot-touching PRs — check the authority direction.
- The interim state is legible: anyone finding class-owned slot fields can
  follow the exceptions-log entry to the exit condition instead of guessing
  whether it is intended.
- Ecosystem compatibility work (indexed access, array mutation methods,
  reflection, slot identity stability) is on the critical path to retirement
  and must be tested before either interim representation is removed.
- The slot key-kind decision is deferred with its constraints written down;
  ADR-0008's collision-contract amendment gains a slot row when it is made.

## References

- Program decision D-dq-08 (2026-08-24), packet
  `sc-01-slot-destination-decision` (program records; mirrored to the Notion
  decision log per D-proc-01)
- ADR-0008 "Entity Component System," including "Amendment (2026-08-23):
  registration and collision contract"
- `docs/architecture/output-slot-connectivity.md` (deferred `SlotConnection`
  phase; link-connectivity store migration)
- `docs/architecture/node-data-store.md`
- `docs/exceptions-log.md` (central exceptions log; companion entry)
- #14246 (ECS migration merge), #15544 (descriptor/Proxy boundary proposal)
