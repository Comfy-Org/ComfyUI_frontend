# 27. Seq-Gap Recovery Is State-Vector Delta Replay — Never Wipe the Follower Doc

Date: 2026-08-28

## Status

Proposed. ADR-019 is the freeze exit; it is provisional under the 48-hour
auto-ratify rule and auto-ratifies on 2026-08-30.

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

### `doc_reset` versus an ordinary sequence gap

A lost or undelivered `doc_reset` and an ordinary sequence gap are not the same event. A
`doc_reset` declares a lineage break and requires full document replacement after every
projector and consumer has been notified. A sequence gap only says that transport frames
were missed; it never authorizes replacement of the existing Y.Doc. The transport-cursor,
missed-reset precedence, and replacement-completion-barrier contracts remain deferred to
DQ-24 and are not decided by this ADR.

### Governing ADR-019 tradeoffs

[ADR-019](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-019-crdt-weekend-final-call.md)
is the governing weekend final call:

- **Bounded scalar-v1:** scalar-v1 is frozen for weekend dogfood as a bounded
  exception; the Lamport clock remains the committed V1 migration before
  Local/Desktop.
- **Reset/remint deferral:** reset/remint semantics are excluded from weekend
  acceptance, durable lineage remains a pre-public gate before MS21 planning, and
  remint is disabled while followers are connected.
- **Deployed-proof bar:** only deployed browser proof establishes dogfood readiness;
  local-only results remain local-only.

These tradeoffs bound the decision recorded here. They do not settle the deferred
lineage, cursor, reset-precedence, or replacement-barrier contracts.

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
- [ADR-019 — CRDT weekend final call](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-019-crdt-weekend-final-call.md)
  — bounded scalar-v1, reset/remint deferral, and the deployed-proof bar.
- [DQ-47 resolution](https://github.com/christian-byrne/blocked-on-christian/issues/56#issuecomment-5462261123)
  — vehicle, status, and deferred-contract disposition.
- `poc/fe-crdt-follower` → `layoutFollowerBridge.ts` (reference implementation of
  state-vector delta replay).
