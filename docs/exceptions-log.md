# Repository Exceptions Log

This file is the central log of **known, bounded, deliberate exceptions** to
the repository's house invariants (single source of truth, store-owned state
with derived views, documented-and-tested contracts, no compatibility
guarantees beyond those explicitly granted).

An exception belongs here when a change knowingly deviates from an invariant
**on purpose** — as a transitional state, a scoped compatibility contract, or
a consciously accepted gap — rather than by accident. Logging it makes the
deviation legible: anyone who finds the deviating code can look up whether it
is intended, who owns it, and what closes it.

## Rules

1. **Every entry has an owner, an entry date, an exit condition, and a link
   to the decision that granted it.** An exception without an exit condition
   is not an exception; it is an unrecorded change to the invariant.
2. **Entries are never silently deleted.** When an exception's exit condition
   is met, move its row to the Closed section with the closing date and the
   change that closed it.
3. **Exceptions do not generalize.** Each entry covers exactly the scope it
   states. Extending an exception (more properties, more stores, more time)
   requires a new decision, not an edit to the existing row.
4. **Reviewers may cite this log.** A PR that deviates from a house invariant
   without a matching entry here (or a new entry added in the same PR) is a
   defect, not a judgment call.

## Open exceptions

### EX-001 — Slot state is class-owned (dual representation) during the slot migration

| Field                  | Value                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invariant excepted** | Stores own entity state; class instances and boundary projections are derived views.                                                                                                                                                                                                                                                                        |
| **Exception**          | Node slot state (`NodeInputSlot` / `NodeOutputSlot` instances) remains live, class-owned state: `NodeState` holds slot-class instances, `nodeShellState` exposes them via `shallowReactive` arrays, and `LGraphNode.inputs`/`outputs` read them through the store proxy. The store holds the _container_; the slot _fields_ are class-owned.                |
| **Owner**              | Christian Byrne                                                                                                                                                                                                                                                                                                                                             |
| **Entered**            | 2026-08-24                                                                                                                                                                                                                                                                                                                                                  |
| **Exit condition**     | ID-based slot records own slot state and **both** interim representations — the class-instance `NodeState` arrays and any descriptor/Proxy boundary layer (#15544 family) — are retired. Authority direction is one-way in the meantime: once a slot field moves store-side, no change may make a class instance or projection authoritative over it again. |
| **Decision record**    | [ADR-0017](adr/0017-id-based-slot-records-are-the-slot-destination.md) (program decision D-dq-08, 2026-08-24; mirrored to the Notion decision log)                                                                                                                                                                                                          |

### EX-002 — Store collision contract is live in code but not yet documented and pinned on `main`

| Field                  | Value                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invariant excepted** | Behavioral contracts are documented in ADRs and pinned by tests before they are relied on.                                                                                                                                                                                                                                                                  |
| **Exception**          | The per-store registration collision contract (identity-keyed stores — `nodeDataStore`, `linkStore`, `rerouteStore` — reject on collision, caller remints; the structural-keyed `widgetValueStore` resolves) is live in code, but `main`'s ADR collision table predates it and misstates per-store behavior, and no invariant test suite pins the contract. |
| **Owner**              | Christian Byrne                                                                                                                                                                                                                                                                                                                                             |
| **Entered**            | 2026-08-24                                                                                                                                                                                                                                                                                                                                                  |
| **Exit condition**     | The D-dq-04 bundle lands on `main`: the remint-loop collision log (#15720), the corrected contract documentation (#15761 rebase — ADR-0003 table corrections and the ADR-0008 registration/collision amendment), and the four-store invariant test suite (`src/stores/storeCollisionContracts.test.ts`).                                                    |
| **Decision record**    | Program decision D-dq-04 (2026-08-24; mirrored to the Notion decision log); PRs #15720, #15761; issue #15743                                                                                                                                                                                                                                                |

### EX-003 — `LLink` guarantees exactly seven own-enumerable legacy topology properties

| Field                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Invariant excepted** | Entity instances make no enumeration or spread-copy compatibility guarantee; state is exposed through accessors over store-backed state.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Exception**          | Exactly seven historically own-enumerable `LLink` properties — `id`, `type`, `origin_id`, `origin_slot`, `target_id`, `target_slot`, `parentId` — are preserved as own enumerable **forwarding descriptors** (prototype accessors copied onto each instance) so ecosystem spread-copy consumers keep working. Reads and writes still delegate to the store-backed `LLink._state`; no synchronized plain fields exist. This is **not** a general entity-enumeration guarantee: no other `LLink` keys, and no other entity types (`Reroute`, widgets, nodes), are covered. |
| **Owner**              | Christian Byrne (implementation vehicle: #15654)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Entered**            | 2026-08-24                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Exit condition**     | Bounded in scope, not time. Superseding decision required if: the project adopts and publishes a breaking policy that entity enumeration is unsupported; the forwarding descriptors are shown to violate a concrete invariant; or measured consumers require an exact whole-object/key-order contract rather than these seven values.                                                                                                                                                                                                                                    |
| **Decision record**    | Program decision D-c6-01 (2026-08-24; mirrored to the Notion decision log); PR #15654 (implementation), PR #15778 (closed as duplicate; carries the original patch and discussion)                                                                                                                                                                                                                                                                                                                                                                                       |

## Closed exceptions

_None yet._
