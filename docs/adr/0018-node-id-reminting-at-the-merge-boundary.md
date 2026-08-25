# 18. Node-ID Reminting at the Merge Boundary

Date: 2026-08-25

## Status

Proposed

Derivation record for program decision D-gl-A6. The direction is already
carried in practice by ADR-0003's merge-boundary reconciliation amendment
(2026-08-23) and by the collision contracts pinned in the D-dq-04 bundle
(#15720 tests + #15761 docs); this ADR models the reminting question in full
so the reasoning is reviewable independently of those PRs.

## Context

### The id space is the problem, not the CRDT

ComfyUI node ids (`NodeId`) are small bare integers assigned per graph and
persisted in serialized workflows. They are **not actor-scoped**: nothing in
the id encodes which client (or which historical workflow file) minted it. In
a single-client world this is harmless — the graph that mints an id is the
only authority over it.

The CRDT-based collaboration direction (ADR-0003) and the ECS store migration
(ADR-0008) break that assumption. Two replicas can each independently mint
node id `7` for two **different** entities. When one replica's content reaches
the other — via CRDT sync, workflow import, subgraph paste, or any other
merge-shaped operation — both entities claim the same key in every id-keyed
registry.

### What a collision means

Per the collision-contract taxonomy (D-gl-A4, pinned by the #15720 test suite
and documented in the ADR-0003/ADR-0008 amendments of #15761):

- **Identity keys reject.** A collision on an identity key is two different
  entities claiming one name. They must never be merged; merging silently
  destroys one entity's history.
- **Structural keys resolve.** Same position + same type is the same logical
  slot; carry the value.

A duplicate `NodeId` is an identity-key collision. The question this ADR
answers is _where_ the rejection-and-recovery happens.

## Decision

**CRDT duplicate-id reconciliation lives at the merge boundary. Registries
keep a strict no-collision invariant.**

Concretely:

1. Stores and registries (nodeStore, linkStore, rerouteStore,
   widgetValueStore, and any future id-keyed registry) treat a second
   _different_ object claiming a registered id as a programming-error-grade
   event: reject, never silently remap. (Same raw object re-registered under
   the same owner is idempotent and returns the incumbent — see
   `linkStore.ts` registration.)
2. The **merge boundary** — the code path where external content enters a
   replica (`nodeShellLifecycle` remint loop for node shells) — detects the
   collision _before_ store registration, mints a fresh id for the incoming
   copy, and emits a `console.warn` naming the old id, the replacement id,
   and the root graph id. The warning is required by D-gl-A2: no silent
   remints, ever — telemetry and debugging depend on collisions being
   observable.
3. The reminted id is drawn from a space that cannot re-collide (fresh with
   respect to the local registry, and unique going forward), so reminting
   terminates and never ping-pongs.

### Echo-back semantics (why this converges)

The most common confusion: "if client B remints client A's node, doesn't that
conflict with A's copy when it syncs back?" No — because B remints **its
imported copy**, never A's original.

```
Client A                          Client B
+-----------------+               +-----------------+
| mints node id 7 |               | mints node id 7 |   two DIFFERENT entities,
| (its own node)  |               | (its own node)  |   same id -- by accident
+--------+--------+               +--------+--------+
         |  A's ops sync to B              |
         v                                 |
+--------------------------------+         |
| B's MERGE BOUNDARY             |         |
| registry: "7 is taken"         |<--------+
| -> remint A's copy to 7'       |
| -> console.warn(old, new, root)|
+--------+-----------------------+
         | remint is an ordinary local edit on B's replica
         | -> becomes a normal CRDT op -> syncs back to A
         v
+-----------------+               +-----------------+
| A: own 7 + B's  |               | B: own 7 + A's  |
| copy of A-node  |               | copy of A-node  |
| stays 7; B-node |               | as 7'; own      |
| arrives as its  |               | B-node stays 7  |
| own id          |               |                 |
+-----------------+               +-----------------+
     converged: same two nodes, same two ids, everywhere
```

The remint is a local edit that propagates like any other operation. Neither
replica ever holds two live entities under one id, so the registry invariant
holds on both sides at all times, and both replicas converge on the same
(node, id) pairs.

### Relationship to CRDT creator-minting

CRDT practice says the creator mints ids, actor-scoped (actor id + counter),
making collisions impossible by construction. Merge-boundary reminting does
not violate that principle — it **compensates for an id space that predates
it**. The importer is, in CRDT terms, the creator of the imported copy inside
its replica, and it mints accordingly.

**Future work (recorded, not scheduled):** make node ids actor-scoped at
creation. Once that lands, merge-boundary reminting decays to dead code for
new content and is retained only as the import adapter for legacy serialized
workflows. This is the durable fix; reminting is the bridge.

### Revisit trigger

If a Yjs document ever keys a **shared** map by raw `NodeId` across clients,
this decision stops being sufficient: ids would need to be globally unique at
creation time, which forces the actor-scoped refactor immediately rather than
eventually.

## Alternatives considered

### Store-side remap (rejected)

Let stores absorb collisions by remapping ids internally on registration.

- Violates D-gl-A2 directly: the remap is exactly the silent remint that
  decision forbids.
- Smears merge logic across every store instead of one boundary; every
  future store must reimplement it.
- Hides real data-model bugs behind auto-repair — a duplicate id caused by a
  lifecycle bug would be silently "fixed" instead of surfaced.
- Breaks the identity-keys-reject contract already pinned by the #15720
  suite.

### Hybrid: registries tolerate duplicates temporarily (rejected)

Tag colliding entries with an epoch/namespace and reconcile lazily.

- Ids stop being unique within a replica window, which poisons every
  id-keyed map, cache, and lookup in the codebase for the duration.
- Largest implementation surface of the three options with the least
  predictable failure modes.

## Consequences

- Registries stay simple and their no-collision invariant is test-pinned
  (#15720). Collision handling is localized to one auditable boundary.
- Every collision is observable (the required warning), so telemetry can
  count real-world collision frequency and inform the actor-scoped refactor's
  priority.
- **Known deliberate gap (open at time of writing):** the remint loop does
  not yet record an old→new id map, and `LGraph.configure` restores links
  before nodes are added — so serialized link endpoints referencing the old
  id dangle after a remint. ADR-0008 (as amended in #15761) documents the gap
  and its two candidate fixes: (a) record the map during the remint loop and
  remap serialized link/reroute/group endpoints before `configure` restores
  connections, or (b) reject ambiguous payloads outright. Until one lands,
  reminting is correct for node identity but incomplete for references.
- Imports/pastes of colliding content mutate the incoming copy's id. Any
  external system that memorized the old id (e.g. a URL fragment or a test
  fixture) will miss; this is inherent to any rejection-based scheme and is
  the cost of never merging two distinct entities.

## References

- ADR-0003 — Centralized Layout Management with CRDT (merge-boundary
  reconciliation amendment, 2026-08-23). Cite ADR-0003 externally; this ADR
  is the derivation record.
- ADR-0008 — Entity Component System (collision-contract and remint-gap
  amendments via #15761).
- ADR-0017 — ID-Based Slot Records Are the Slot Destination (the same
  identity-vs-structural key taxonomy, applied to slots).
- #15720 — collision-contract invariant test suite (registry rejection +
  remint warning pinned).
- #15761 — collision-contract documentation fold.
- Program decisions D-gl-A2 (no silent remints), D-gl-A4 (identity keys
  reject / structural keys resolve), D-gl-A6 (this decision).

## Glossary

- **Merge boundary** — any code path where content minted outside the local
  replica enters it: CRDT sync apply, workflow import, paste, subgraph
  instantiation from a serialized payload.
- **Remint** — assigning a fresh id to an _incoming copy_ of an entity whose
  claimed id is already registered locally. Never applied to the incumbent.
- **Identity key** — a key whose collision means two different entities claim
  one name (e.g. `NodeId`). Contract: reject.
- **Structural key** — a key derived from position/shape where collision
  means "same logical slot" (e.g. widget slot index + type). Contract:
  resolve.
- **Actor-scoped id** — an id embedding the minting client's identity
  (actor id + counter), collision-free by construction; the eventual
  replacement for bare-integer node ids.
- **Echo-back** — the reminted copy propagating back to the originating
  client as an ordinary CRDT operation, converging both replicas.
- **Registry no-collision invariant** — a store never holds two different
  live objects under one id; second different claimant is rejected.
