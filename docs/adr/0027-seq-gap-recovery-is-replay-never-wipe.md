# 27. Lineage-Gated Replay (LGR) for Sequence-Gap Recovery

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
follower code on in-flight branches. However, a gap alone cannot distinguish a missing
ordinary update from a missing `doc_reset`. Yjs state vectors identify known structs,
not the application-level lineage of a document. Replaying a vector against a newly
minted host doc can therefore retain stale structs from the old lineage.

The protocol must make lineage observable before delta replay is safe. Every document
lineage has an immutable generation ID minted with the host Y.Doc. The host includes it
in every `doc_update`, `doc_reset`, and `doc_subscribed` frame, while the follower stores
it with its Y.Doc and includes it in subscription requests. Missing, unverifiable, or
mismatched generation IDs are lineage breaks; state vectors must never cross them.

## Decision

1. On a sequence gap or reconnect, the follower resubscribes with its generation ID and
   state vector.
2. The follower keeps its existing Y.Doc and applies the returned delta only after the
   host confirms the same generation.
3. A missing, unverifiable, or different generation is a lineage break. The follower
   MUST dispatch `doc_reset` to every projector and consumer before replacing the doc
   and subscribing from an empty state vector.
4. An explicit `doc_reset` follows the same lineage-break path. The reset event MUST be
   dispatched before replacement.
5. Replacing a follower doc after a confirmed same-generation gap is a defect. Applying
   an update from an unverified or different generation to the existing doc is also a
   defect.

### `doc_reset` versus an ordinary sequence gap

A sequence gap does not reveal which frame was lost. If generation validation confirms
the existing lineage, the missing frame was not a reset and delta replay preserves the
follower doc. If validation fails, recovery must infer a lineage break because the lost
frame may have been `doc_reset`. Both an inferred lineage break and an explicit
`doc_reset` use the same ordered reset-before-replacement lifecycle. The transport-cursor
and replacement-completion-barrier details remain deferred to DQ-24.

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

- Reviews of sync/reconnect code reject both replacement after a confirmed
  same-generation gap and delta replay without a confirmed generation.
- Follower recovery logic must track the doc's generation and state vector. The
  transport protocol must reject delta resubscription across generations.
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
- [`docFrameClient.ts`](../../src/workbench/extensions/agent/crdt/docFrameClient.ts) is
  the frame parser and subscription encoder that must carry and validate generation IDs.
- [`layoutFollowerBridge.ts`](../../src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts)
  owns gap recovery and the ordered reset-before-replacement lifecycle. Generation
  validation is a prerequisite for its same-doc delta path.
