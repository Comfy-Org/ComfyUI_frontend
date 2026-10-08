# ADR-002: Ops are the replication unit; raw Yjs updates only host→follower

**Status:** Accepted
**Date:** 2026-08-20
**Invariants:** KA-1, KA-6, FC-1

## Context

Yjs binary updates are safe for followers forked from one host-owned document, but exchanging raw struct updates between documents that were independently seeded and edited can corrupt semantic fields and diverge projections.

Semantic operations carry domain intent and the ordering identity `[base_version, actor, op_id]`, allowing every replica to evaluate the same conflict rules.

## Decision

- Semantic ops are the replication unit between independently editing replicas.
- A follower sends semantic ops toward the host and never writes the shared document directly.
- After applying ops, the host may fan out incremental raw Yjs updates to followers one-way.
- Bootstrap and reconnect fork from one common seeded snapshot.
- Presence remains on the awareness channel and outside the semantic document.

## Consequences

- Independently edited replicas converge by replaying semantic intent rather than merging unrelated Yjs struct identities.
- Followers can integrate efficient host deltas without becoming document writers.
- Transport remains replaceable; this decision constrains replication semantics, not WebSocket, Redis, or WebRTC selection.
- Offline peer-to-peer evolution remains possible because ops carry ordering identity.

## Alternatives considered

- **Bidirectional raw Yjs updates:** rejected as FC-1; this is the demonstrated corruption path.
- **Full-document replacement:** rejected because it clobbers concurrent edits and removes replayability.
