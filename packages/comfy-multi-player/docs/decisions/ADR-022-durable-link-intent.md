# ADR-022: Preserve durable link intent across node-presence races

- **Status:** Proposed
- **Date:** 2026-09-03
- **Decider:** pending review on the integration PR
- **Depends on:** Amendment A7 (node presence), Amendment A18 (normalized link identity)

## Context

`delete_node` currently removes an incident live link only when the delete wins
the node-presence register. That is locally sensible but not convergent when a
link already exists in the common snapshot. Given an add at stamp 9 and a
delete at stamp 5, applying add then delete keeps the link because the delete
loses; applying delete then add removes the link before the later add arrives.
The node survives in both replicas, but the graph does not.

Always deleting every incident link is not correct. Amendment A7 says incident
links are severed only when the node is actually removed; a losing delete must
not permanently disconnect a node that survives. The reproducer in
`test/delete-node-lww-loser-removed-links.test.ts` also shows that explicitly
named `removed_links` have different semantics: those removals are ungated and
permanent even when node deletion loses.

The current `links` root cannot represent these distinctions. Once an
incident tuple is deleted, it contains no durable evidence that a winning
connect intent should become live again after a higher-stamped re-add.

## Decision

Introduce a schema-v3 `__link_state` root keyed by normalized link id. It is
the durable source of link intent; `links` remains the materialized set exposed
to projection and existing readers.

Each `__link_state` entry is one of:

1. **Connect intent:** the complete normalized A18 link tuple, its winning
   link-identity stamp, and the destination-input authority that admitted it.
2. **Removal tombstone:** a terminal explicit-removal marker for a link id.

The transition rules are:

- A winning `connect` stores or replaces connect intent after the existing A18
  link-identity and destination-input gates pass. It materializes the tuple
  only while both endpoint nodes exist and the destination authority still
  owns its input.
- A winning node delete dematerializes incident tuples but keeps their connect
  intent. A later winning re-add rematerializes each still-eligible intent.
- A losing node delete does not change incident intent or materialization.
- Every id in `delete_node.removed_links` writes a removal tombstone even when
  no live tuple has that id. This preserves A7's ungated, monotonic severance
  and prevents an older or hidden connect intent from reappearing.
- `disconnect` retires the matching connect intent when it wins the destination
  input register, including while the tuple is hidden by endpoint absence.
- A later A18 link-identity winner may replace older connect intent, but an
  explicit-removal tombstone for that normalized id is terminal because the op
  vocabulary does not permit link-id reuse.
- `clear` follows the same node-delete dematerialization rule and writes
  tombstones for explicitly removed links.

Materialization is derived only from durable registers. Arrival order never
decides whether intent exists, whether it is eligible, or whether its endpoint
references are installed.

## Schema and migration

This adds a root map, so `SCHEMA_VERSION` must move from 2 to 3 (KA-11). The
host-owned v2 → v3 migration seeds one connect-intent entry for every live v2
`links` tuple, using its A18 `("link", normalized_id)` stamp and the current
destination-input stamp. A malformed live tuple or missing authority fails
closed rather than inventing ordering metadata.

`mint()` and `initDoc()` create `__link_state`; the wire-layout fixture,
schema documentation, root-name mutation guards, and read-surface accessors
move in the same change. Snapshot compaction must retain `__link_state` even
for currently hidden links. Re-minting from `project(doc)` alone would discard
intent, so compaction must copy the durable root or use a schema-owned compact
representation rather than treating projected workflow JSON as complete
state.

## Required implementation gates

The implementation is not complete until permanent tests cover:

- the seeded-link add/delete race in both arrival orders;
- winning delete followed by a higher re-add at either endpoint;
- named removal of a live link and of a nonexistent link;
- disconnect while an intent is hidden;
- competing A18 link-identity and destination-input winners;
- source-delete/re-add and destination-delete/re-add cycles;
- duplicate delivery and both batch boundaries;
- v2 → v3 migration, current-version no-op, unreadable-schema refusal;
- `clear`, snapshot encoding, and compaction retention.

The convergence tests must fork replicas from one snapshot (KA-10), compare
canonical projections after legal causal permutations (KA-4), and verify
byte-identical retry behavior. The v3 wire-layout test must make omission or
renaming of `__link_state` fail.

## Rejected alternatives

- **Always remove incident links:** converges by permanently severing wiring
  for a delete that loses node presence, contradicting A7.
- **Reconstruct from the deleted tuple:** the tuple no longer exists in one
  arrival order, so reconstruction itself is arrival-dependent.
- **Keep hidden tuples in `links`:** makes projection and current callers see
  links whose endpoints are absent, violating the existing live-link contract.
- **Encode intent only in `__stamps`:** a stamp cannot recover the complete
  tuple or the destination authority needed to decide materialization.

## Consequences

- The graph converges without changing the product meaning of a losing node
  delete or an explicit named severance.
- Link lifecycle becomes an explicit durable state machine rather than an
  inference from the currently materialized graph.
- The change is intentionally schema-wide: migration and compaction are part
  of correctness, not follow-up cleanup.
- Hidden intent increases document size until an explicit removal retires it;
  host compaction can discard only state proven unreachable under the no-id-
  reuse rule.

## Glossary

- **A7:** schema amendment defining stamp-gated node presence and ungated
  `removed_links` severance.
- **A18:** schema amendment defining normalized, stamped ownership of a
  complete link tuple.
- **Connect intent:** durable evidence that a winning connect should be live
  whenever its endpoint and input-register conditions hold.
- **Destination authority:** the winning input-register stamp that permits a
  link to occupy a concrete or grown destination slot.
- **Dematerialize:** remove a tuple and endpoint references from the live graph
  without deleting its durable connect intent.
- **KA-4:** deterministic and idempotent application invariant.
- **KA-10:** all replicas bootstrap from one seeded Yjs snapshot.
- **KA-11:** fail-closed schema-version discipline.
- **Removal tombstone:** durable proof that a normalized link id was explicitly
  retired and must not rematerialize.
