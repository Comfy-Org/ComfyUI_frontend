# 28. Coordination-Free Ids for Shared Graph Documents

Date: 2026-09-01

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

[ADR-0018](0018-node-id-reminting-at-the-merge-boundary.md) chose merge-boundary
reminting for node ids and recorded an explicit revisit trigger:

> If a Yjs document ever keys a **shared** map by raw `NodeId` across clients, this
> decision stops being sufficient: ids would need to be globally unique at creation
> time, which forces the actor-scoped refactor immediately rather than eventually.

That trigger has fired. The in-app agent follower
([ADR-0025](0025-in-app-agent-crdt-follower-and-distribution.md)) keys the shared
document's `nodes` map by raw node id, and the human mint ports added alongside it now
author `add_node` and `connect` operations from the local canvas. Two replicas seeded
from the same snapshot both hold `lastNodeId: 12`; both allocate `13`; the register for
node `13` in the shared map takes one of the two by last-writer-wins and the other
user's node silently becomes the first user's node.

ADR-0018 named actor-scoped ids (`actor:counter`) as the durable fix. That remains the
better long-term shape, but it changes the wire type of every node id in serialized
workflows, in the prompt payload, in `zNodeId`, and across 40+ custom-node repos that
read `node.id`. It is not a change that can ride along with a follower bug fix.

## Decision

Partition the safe-integer space and mint the shared range randomly.

1. **Range partition.** Sequential counter ids occupy `[0, 2**40)`. Coordination-free
   ids occupy `[2**40, 2**53)`. The two ranges are disjoint, so an id minted under one
   regime can never collide with an id minted under the other.
2. **Opt-in per graph state.** `setCoordinationFreeIds(state, enabled)` arms an
   `LGraphState`; `mintNodeId` and `mintLinkId` return a random id in the shared range
   only while the state is armed. The agent follower arms the bound graph and disarms it
   on unbind, so nothing changes for a user who never opens the agent panel.
3. **Random, not actor-scoped.** Ids stay `number`, which is what makes this shippable
   without touching the wire type. The shared span is `2**53 - 2**40` (~9.0e15); at
   10^5 nodes in one document the birthday collision probability is ~5.5e-7, and every
   high-volume minting call site already retries on a registry reject
   (`LGraphCanvas`'s used-id loop, `subgraphDeduplication.findNextAvailableId`, and
   ADR-0018's own remint-on-reject path in `LGraph.add`).
4. **Counters never observe shared ids.** `observeNodeId`, `observeLinkId`,
   `observeGroupId` and `observeRerouteId` ignore any value outside `[0, 2**40)`. A
   replica loading a workflow that contains shared-range ids keeps its counter in the
   sequential range and cannot mint into the shared one by accident.
5. **Load-time remapping stays sequential.** `subgraphDeduplication` mints sequential
   ids even while a state is armed. Both replicas process the same snapshot, so a
   deterministic remap converges; a random remap would diverge.

## Consequences

- `last_node_id` and `last_link_id` in a serialized workflow no longer bound the node
  and link ids in that file. A workflow saved mid-agent-session can contain node
  `1099511628031` next to `last_node_id: 3`. No in-tree consumer treats those fields as
  a maximum, but third-party tooling that computes `graph.last_node_id + 1` to mint an
  id will produce a duplicate.
- The `[0, 2**40)` boundary is load-bearing in two places: the `observe*` functions and
  the deprecated `last_node_id` / `last_link_id` setters on `LGraph`, both gated through
  `isSequentialCounter`/`toSequentialCounter` in `idAllocation.ts`; neither may hard-code
  the bound. Node and link ids are the only entities coordination-free minting applies to
  (`mintNodeId`/`mintLinkId`), so group and reroute ids have no `MINT_ID_MIN` gate to
  begin with — `subgraphDeduplication`'s `mintGroupId`/`mintRerouteId` calls and its
  `MAX_ID = 100_000_000` exhaustion ceiling are a separate, independent dedup-remap bound
  unrelated to `MINT_ID_MIN`.
- Rejected counter writes are dropped rather than thrown, and only warn under
  `import.meta.env.DEV`. A poisoned counter in production is silent.
- This does not make ids globally unique at creation in the sense ADR-0018 meant.
  It makes collisions improbable rather than impossible, which is sufficient for the
  document sizes the agent works with and insufficient as a permanent answer.

## Alternatives considered

### Actor-scoped ids (deferred, not rejected)

ADR-0018's recorded plan: `actor:counter` string ids, collision-free by construction.
Correct, and still the destination. Deferred because it changes the serialized wire type
of every node id, which is a migration with its own ADR and its own rollout, not a line
item inside a follower fix. When it lands, this ADR is superseded and both `MINT_ID_MIN`
gates come out together.

### UUID node ids (rejected)

Collision-free and no partition needed, but `zNodeId` and the prompt payload treat
numeric ids as the common case, and every custom node that formats or compares ids
numerically would need migration. Strictly more disruptive than actor-scoped ids for the
same benefit.

### Server-allocated id ranges (rejected)

The doc host hands each client a reserved block. Removes the probabilistic element, but
adds a round trip on the critical path of node creation and a new failure mode when the
block is exhausted while offline. The follower is explicitly designed to keep local
edits working when the channel is down.

## References

- [ADR-0018](0018-node-id-reminting-at-the-merge-boundary.md) — merge-boundary reminting
  and the revisit trigger this ADR answers
- [ADR-0024](0024-in-app-agent-offscreen-graphs.md) — graph activation and document
  objects for agent targets
- [ADR-0025](0025-in-app-agent-crdt-follower-and-distribution.md) — the follower that
  keys a shared map by raw node id
- `src/lib/litegraph/src/idAllocation.ts` — `MINT_ID_MIN`, `setCoordinationFreeIds`,
  `mintCoordinationFreeId`

## Glossary

- **Coordination-free id**: an id a replica may mint without consulting any other
  replica, safe because the range it draws from is large enough that collisions are
  negligible.
- **Armed state**: an `LGraphState` registered with `setCoordinationFreeIds`, whose
  `mintNodeId` / `mintLinkId` draw from the shared range.
- **Sequential range**: `[0, 2**40)`, the counter-allocated space that predates shared
  documents and that every non-agent session continues to use.
