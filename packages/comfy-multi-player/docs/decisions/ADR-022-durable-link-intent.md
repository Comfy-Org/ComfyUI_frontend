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

The materialized `links` root cannot represent these distinctions by itself.
Once an incident tuple is deleted, it contains no durable evidence that a
winning connect should become live again after a higher-stamped re-add. The
A18 link-identity register already owns that complete tuple; it is the durable
authority that must retain it.

## Decision

Reuse the existing A18 rows in `__stamps` as the durable source of link intent;
`links` remains the materialized set exposed to projection and existing
readers. A live intent row has this shape:

```text
["link", normalized_link_id] -> [counter, actor, op_id, complete_link_tuple]
```

The first three fields remain the existing `StampKey`. The fourth field makes
the complete tuple that A18 says the register owns recoverable after temporary
dematerialization. Explicit removal uses a separate terminal row so it cannot
erase the identity winner or skip that winner's other register effects:

```text
["link_retired", normalized_link_id] -> [counter, actor, op_id]
```

The transition rules are:

- `mint()` seeds one intent row for every imported live link. A winning
  `connect` stores or replaces the intent after the existing A18 link-identity
  and destination-input gates pass.
- A tuple is materialized only while both endpoint nodes exist and the
  destination-input register still authorizes its stamp. An imported link has
  no destination-input stamp and is eligible by default.
- A winning node delete dematerializes incident tuples but keeps their connect
  intent. A later winning re-add rematerializes each still-eligible intent.
- A losing node delete does not change incident intent or materialization.
- Every id in `delete_node.removed_links` writes a retirement row even when
  no live tuple has that id. This preserves A7's ungated, monotonic severance
  and prevents an older or hidden connect intent from reappearing.
- Displacing an incumbent from an input dematerializes it but does not retire
  its identity. Its intent remains governed by the destination-input stamp;
  treating displacement as explicit retirement made valid later A18 winners
  arrival-order dependent.
- `disconnect` retires the live incumbent when it wins the destination-input
  register. A retirement row is terminal because the vocabulary does not
  permit link-id reuse. A later `connect` may still claim its normal registers,
  but it cannot materialize a retired id.
- `clear` follows the same node-delete dematerialization rule.

Materialization is derived only from durable registers. Arrival order never
decides whether intent exists, whether it is eligible, or whether its endpoint
references are installed.

## Schema and migration

No root is added or renamed: link intent and retirement are internal rows in
the existing `__stamps` map, so `SCHEMA_VERSION` remains 2. This follows the
single-format private-alpha decision in A17 and KA-2: it is a direct semantic
change, not a schema-v3 format, migration, compatibility shim, or dual reader.
Documents minted before this change have no recoverable tuple for a hidden
link and must be re-minted during private alpha rather than guessed at.

Snapshot compaction already retains `__stamps`; it must continue to retain
link-intent rows even while their tuples are not materialized. Re-minting from
`project(doc)` alone is insufficient once hidden intent exists.

## Required implementation gates

The implementation is not complete until permanent tests cover:

- the seeded-link add/delete race in both arrival orders;
- named removal of a live link and of a nonexistent link;
- competing A18 link-identity and destination-input winners;
- connect displacement without accidental retirement;
- duplicate delivery and the existing broad legal-permutation suites;
- snapshot encoding and wire-layout retention of the extended stamp row.

The convergence tests must fork replicas from one snapshot (KA-10), compare
canonical projections after legal causal permutations (KA-4), and verify
byte-identical retry behavior. The wire-layout test must prove the extended
intent row survives bootstrap snapshot encoding without changing root names.

## Rejected alternatives

- **Always remove incident links:** converges by permanently severing wiring
  for a delete that loses node presence, contradicting A7.
- **Reconstruct from the deleted tuple:** the tuple no longer exists in one
  arrival order, so reconstruction itself is arrival-dependent.
- **Keep hidden tuples in `links`:** makes projection and current callers see
  links whose endpoints are absent, violating the existing live-link contract.
- **A new `__link_state` root and schema v3:** duplicates the existing A18
  identity ledger and contradicts the accepted private-alpha single-format
  decision. The existing row can retain its owned tuple without a new root.
- **Overwrite the A18 row with a tombstone:** loses the identity winner and can
  skip destination-input side effects, recreating arrival-order dependence.

## Consequences

- The graph converges without changing the product meaning of a losing node
  delete or an explicit named severance.
- Link lifecycle becomes explicit durable bookkeeping rather than an inference
  from the currently materialized graph.
- The wire root layout and schema version do not change.
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
- **Retirement row:** durable proof that a normalized link id was explicitly
  retired and must not rematerialize.
