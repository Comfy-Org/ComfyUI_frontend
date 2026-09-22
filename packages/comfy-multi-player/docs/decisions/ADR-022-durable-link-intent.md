# ADR-022: Preserve durable link intent across node-presence races

- **Status:** Proposed
- **Date:** 2026-09-03
- **Depends on:** [Amendment A7](../multiplayer-schema.md#amendment-a7--2026-08-21--stamp-gated-node-presence-canonical-autogrow-naming-scoped-clear-issue-11) (node presence), [Amendment A18](../multiplayer-schema.md#amendment-a18--2026-08-30--normalized-stamped-link-identity) (normalized link identity)

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
connect intent should be added to `links` again after a higher-stamped re-add.

## Decision

Introduce a schema-v3 `__link_state` root keyed by normalized link id. It is
the durable source of link intent; `links` remains the live set exposed to
projection and existing readers.

Each `__link_state` entry is one of:

1. **Connect intent:** the complete normalized link tuple, its A18
   link-identity authority, and kind-specific eligibility metadata.
2. **Removal tombstone:** a terminal marker written for a link id explicitly
   named in `delete_node.removed_links`.

Link-identity authority is either a modern A18 stamp or the reserved
`imported` baseline. `imported` is an out-of-band value in `__link_state`, not
a fabricated op stamp or an entry in `__stamps`; every valid op stamp sorts
above it. Eligibility is a discriminated union because the three connect kinds
do not share one destination register:

| Connect kind | Durable eligibility | When the intent is in `links` | Retirement and restoration |
|---|---|---|---|
| Concrete input | Destination target `("input", String(to_node), to_slot)` and the stamp that admitted the connect, or `imported` | Both endpoint nodes exist and that target still names the intent's authority | A winning `disconnect` or a later connect on the target retires the old intent. Endpoint deletion only removes it from `links`; a winning re-add restores it while the same authority still wins. |
| Promoted input | Destination target `("input", String(to_node), "grow", full_declared_name)`, its stamped or `imported` authority, and the declared slot descriptor | Both endpoints exist and the full-name register still names the intent's authority; the declared slot is reused or recreated by name | A later winner on the full-name register retires the old intent. A matching `disconnect` resolves through the stored full-name target rather than treating the current numeric index as a different register. Endpoint deletion and re-add have the same remove/restore behavior as concrete input. |
| Autogrow | The link's unique `grow_id` plus the complete grow request; an imported intent instead carries the exact persisted grown-slot descriptor because its original request is unavailable | Both endpoints exist and that grow identity has not been retired; no destination-input stamp participates | A matching `disconnect` records retirement against that grow identity. An unrelated input-register winner cannot retire it. Endpoint deletion removes the tuple; when destination re-add makes the slot absent, it is recreated from the durable request or imported descriptor before the tuple is restored. |

The inputcount widget write embedded in an autogrow remains its separate
stamped widget register. It does not turn the grown slot into a scalar
destination-input register.

The transition rules are:

- A winning `connect` stores or replaces connect intent after the existing A18
  link-identity gate and its kind-specific eligibility checks pass. It adds the
  tuple and coherent endpoint references to `links` only while the conditions
  in the table hold.
- A winning node delete removes incident tuples and endpoint references from
  the live graph but keeps their connect intent. A later winning re-add adds
  each still-eligible intent back to `links`.
- A losing node delete changes neither incident intent nor `links`.
- Every id in `delete_node.removed_links` writes a removal tombstone even when
  no live tuple has that id. This preserves A7's ungated, monotonic severance
  and prevents an older or hidden connect intent from reappearing.
- `disconnect` retires the matching connect intent according to its stored
  eligibility kind, including while the tuple is absent because an endpoint is
  absent. The durable state, not the current `links` entry, supplies the kind
  and target.
- A later A18 link-identity winner may replace older connect intent, but an
  explicit-removal tombstone for that normalized id is terminal because the op
  vocabulary does not permit link-id reuse.
- `clear` has only `removed_nodes`; it writes no link tombstones. It removes a
  live incident tuple only when deletion wins for at least one endpoint named
  in `removed_nodes`, and keeps that tuple's intent for a later winning re-add.
  Permanent severance by `clear` would require an operation-vocabulary change
  that supplies explicit link ids.

The live graph is derived only from durable registers. Arrival order never
decides whether intent exists, whether it is eligible, or whether its tuple and
endpoint references are installed.

## Schema and migration

This adds a root map, so `SCHEMA_VERSION` must move from 2 to 3
([KA-11](../INVARIANTS.md#ka-11--schema-version-discipline-is-enforced-on-read)).
The host-owned v2 → v3 migration validates every live v2 `links` tuple and
seeds one connect-intent entry for it. It classifies the destination in this
order:

1. **Promoted:** the destination node is an instance of a stored definition
   and the destination slot name is one of that definition's declared inputs.
2. **Autogrow:** the destination slot's normalized `grow_id` equals the
   normalized link id.
3. **Concrete:** every other coherent destination slot.

Migration preserves each complete, internally consistent modern record
independently: an A18 record remains the identity authority; a concrete or
promoted input record remains its eligibility authority; and autogrow's grow
and grow-request records remain its request. Where one of those records is
absent, the corresponding authority or descriptor is `imported`. This is the
expected path for ordinary links copied by `mint()`, which have no A18 or
destination-input stamps, and for imported autogrow slots whose original
request is unavailable; the latter preserves the exact slot descriptor already
in the workflow. A future stamped operation always supersedes an `imported`
authority without discarding any modern authority migration did find.

Migration refuses only a malformed or incoherent live tuple: for example, a
non-six-field tuple, a map key that disagrees with its normalized id, a missing
endpoint or indexed slot, or endpoint references that disagree with the tuple.
Missing A18, input, grow, or grow-request stamps are not a refusal and never
cause migration to invent ordering metadata.

`mint()` seeds the same `imported` state directly for coherent workflow links;
`initDoc()` creates the empty root. The wire-layout fixture, schema
documentation, root-name mutation guards, and read-surface accessors move in
the same change. Snapshot compaction must retain `__link_state` even for links
currently absent from `links`. Re-minting from `project(doc)` alone would
discard intent, so compaction must copy the durable root or use a schema-owned
compact representation rather than treating projected workflow JSON as
complete state.

## Required implementation gates

The implementation is not complete until permanent tests cover:

- the imported-baseline link delete/add race in both arrival orders, including
  a winning delete followed by a higher re-add at either endpoint;
- named removal of a live link and of a nonexistent link;
- concrete, promoted, and autogrow eligibility, including a disconnect while
  each kind's intent is absent from `links`;
- competing A18 link-identity and concrete/promoted input-register winners;
- duplicate delivery and both batch boundaries;
- `mint()` and v2 → v3 migration for unstamped concrete, promoted, and
  autogrow links, plus malformed-tuple refusal, current-version no-op, and
  unreadable-schema refusal;
- `clear`, snapshot encoding, and compaction retention.

The convergence tests must fork replicas from one snapshot
([KA-10](../INVARIANTS.md#ka-10--bootstrapreconnect-forks-from-one-seeded-snapshot)),
compare canonical projections after legal causal permutations
([KA-4](../INVARIANTS.md#ka-4--the-applier-is-deterministic-and-idempotent)),
and verify byte-identical retry behavior. The v3 wire-layout test must make
omission or renaming of `__link_state` fail.

## Rejected alternatives

- **Always remove incident links:** converges by permanently severing wiring
  for a delete that loses node presence, contradicting A7.
- **Reconstruct from the deleted tuple:** the tuple no longer exists in one
  arrival order, so reconstruction itself is arrival-dependent.
- **Keep hidden tuples in `links`:** makes projection and current callers see
  links whose endpoints are absent, violating the existing live-link contract.
- **Encode intent only in `__stamps`:** a stamp cannot recover the complete
  tuple or kind-specific eligibility needed to decide live membership.

## Consequences

- The graph converges without changing the product meaning of a losing node
  delete or an explicit named severance.
- Link lifecycle becomes an explicit durable state machine rather than an
  inference from the current live graph.
- The change is intentionally schema-wide: migration and compaction are part
  of correctness, not follow-up cleanup.
- Hidden intent increases document size until an explicit removal retires it;
  host compaction can discard only state proven unreachable under the no-id-
  reuse rule.
