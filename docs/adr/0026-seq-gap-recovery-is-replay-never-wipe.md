# 26. Seq-Gap Recovery Is State-Vector Delta Replay — Never Wipe the Follower Doc

Date: 2026-08-28

## Status

Accepted

## Context

The in-app agent's CRDT follower (introduced on the `poc/fe-crdt-follower` lineage,
building on the CRDT layout direction of [ADR-0003](0003-crdt-based-layout-system.md))
integrates Yjs updates from a single authoritative doc-host. Frames carry sequence
numbers; transport loss can produce a sequence gap on the follower side.

CRDTs exist so that reconnect and missed-frame recovery are cheap: a follower that
detects a sequence gap can resubscribe presenting its existing Y.Doc **state vector**,
and the host replays only the missing delta. Wiping the canvas (destroying or replacing
the follower doc) on an ordinary seq gap throws away exactly the property CRDTs were
adopted for, causes visible canvas flicker and state loss, and desynchronizes any
projector (ECS/semantic) still holding a reference to the old doc instance.

The misconception "seq gap → rebuild the doc" has appeared in review discussion and in
follower code on in-flight branches. The `poc/fe-crdt-follower` branch's
`layoutFollowerBridge.ts` implements the correct behavior: withhold the gapped frame,
resubscribe with the current state vector, receive only the missed delta.

## Decision

1. On a sequence gap or reconnect, the follower **keeps its existing Y.Doc** and
   resubscribes with its state vector; the host replays the delta. The canvas is never
   wiped.
2. Destroying or replacing the follower doc is reserved **exclusively** for an explicit
   `doc_reset` frame — a genuine lineage break (the host re-minted the document). A
   `doc_reset` MUST be dispatched to every projector/consumer of the old doc instance
   before replacement.
3. Any implementation that wipes or replaces the follower doc on an ordinary seq gap or
   reconnect is a **defect**, to be flagged in review regardless of author.

## Consequences

- Reviews of any sync/reconnect code check for doc replacement outside the `doc_reset`
  path.
- Follower recovery logic must track the doc's state vector and support delta
  resubscription; the transport protocol must distinguish ordinary gaps from `doc_reset`
  lineage breaks.
- Projectors and other doc consumers must handle `doc_reset` as an explicit lifecycle
  event rather than discovering a swapped doc instance implicitly.

## Alternatives Considered

- **Wipe-and-refetch on gap**: simple, but destroys the CRDT's reconnect value, breaks
  projector identity, and is a visible UX regression. Rejected.
- **Buffer all frames indefinitely to avoid gaps**: unbounded memory, and gaps still
  occur on transport loss. Rejected.

## References

- [ADR-0003](0003-crdt-based-layout-system.md) — centralized layout management with CRDT.
- `poc/fe-crdt-follower` → `layoutFollowerBridge.ts` (reference implementation of
  state-vector delta replay).
