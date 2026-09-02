# 27. Lineage-Gated Replay (LGR) for Sequence-Gap Recovery

Date: 2026-08-28

## Status

Accepted

## Context

The in-app agent's CRDT follower integrates Yjs updates from one authoritative
doc host. Each frame has a sequence number, so transport loss can leave a gap.

A follower can recover a missed frame by subscribing with its existing Y.Doc
state vector and applying the returned delta. This preserves document identity
and avoids canvas flicker, state loss, and stale references held by projectors.

A gap alone cannot distinguish a missed update from a missed `doc_reset`. Yjs
state vectors identify known structs, not application-level document lineage.
Replaying an old vector against a newly minted host document can retain stale
structs from the previous lineage.

Safe replay therefore requires an immutable generation ID for each host Y.Doc
lineage. Every `doc_update`, `doc_reset`, and `doc_subscribed` frame must carry
that ID. The follower stores it with its Y.Doc and sends it in subscription
requests. A missing, unverifiable, or mismatched ID forces a lineage break; a
state vector must never cross lineages.

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

### Deferred contracts

This ADR does not define transport-cursor recovery, reset precedence, or the
replacement-completion barrier. Those contracts remain deferred to DQ-24.

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
