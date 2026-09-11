# ADR-CRDT-RECOVERY-0029: Lineage-Gated Replay for Sequence-Gap Recovery

Date: 2026-08-28

## Status

Proposed

## Context

The in-app agent's CRDT follower integrates Yjs updates from one authoritative doc
host. Every frame carries a sequence number, so transport loss can leave a gap.

### What the follower does today

`layoutFollowerBridge.ts` detects a gap by comparing an incoming frame's `seq`
against the last applied one, withholds the uncertain frame, and resubscribes with
the state vector of the **existing** follower Y.Doc. It replaces that doc in
exactly two places: an explicit `doc_reset` frame, and a subscribe that names a
different `workflow_id`. A sequence gap never replaces it.

That is the rule
[ADR-GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
records, and this ADR does not change it.

### Why that rule is not sufficient on its own

A gap does not reveal which frame was lost. The missing frame may itself have been
a `doc_reset`. Yjs state vectors identify known structs, not application-level
document lineage, and the frames carry no lineage identity of their own: the
subscribe frame sends `workflow_id` and a base64 state vector and nothing else,
and `workflow_id` is stable across a host remint. A host that re-minted its
document during the gap therefore receives the previous lineage's state vector and
can compute a delta against a document the follower has never seen. Applying that
delta retains structs for which the replacement document holds no tombstones.

Making a missed reset observable requires lineage identity on the wire that
survives a remint: an immutable generation ID minted with the host's Y.Doc,
carried on every `doc_update`, `doc_reset`, and `doc_subscribed` frame, stored by
the follower beside its Y.Doc, and sent back with its subscription.

**No such field exists in the protocol today** — neither the frame parser nor the
subscribe encoder in `docFrameClient.ts` reads or writes one. Adding it is what
this ADR asks for.

## Decision

### Current rule (implemented)

1. On a sequence gap or reconnect, the follower withholds the uncertain frame and
   resubscribes with its current state vector.
2. The follower keeps its existing Y.Doc and applies the returned delta to it.
3. An explicit `doc_reset`, or a subscribe naming a different `workflow_id`, is the
   only path that replaces the follower doc. The reset MUST be dispatched to every
   projector and consumer before replacement, and the next subscribe MUST start
   from an empty state vector.

Rules 1-3 restate ADR-GRAPH-DOCUMENT-0024's replacement rule. **This ADR supersedes
no clause of it.**

### Required protocol change (not implemented)

4. Every `doc_update`, `doc_reset`, and `doc_subscribed` frame MUST carry the host
   Y.Doc's immutable generation ID, and `doc_subscribe` MUST carry the generation
   the follower holds.
5. Once rule 4 ships, gap recovery gains a second replacement trigger: a response
   whose generation differs from the follower's is a lineage break and takes the
   same ordered reset-before-replacement path as rule 3. ADR-GRAPH-DOCUMENT-0024 is
   amended at that point, not before.
6. Until rule 4 ships, a gap is unresolvably ambiguous. Delta replay is the accepted
   behaviour, and the residual risk that the lost frame was a `doc_reset` is
   accepted knowingly rather than traded for a wipe on every gap.

Rule 5 MUST NOT be read as "an absent generation is a lineage break". No frame
carries a generation today, so that reading would replace the follower doc on every
gap — the opposite of rules 1-3 and of the shipped behaviour.

### Defects

- Replacing the follower doc after an ordinary sequence gap is a defect.
- Once rule 4 ships, applying a delta from a different generation to the existing
  doc is a defect.

### Deferred contracts

This ADR does not define transport-cursor recovery, reset precedence, or the
replacement-completion barrier. Those contracts are open and are not settled by
any record this ADR relies on.

## Consequences

- Reviews of sync/reconnect code reject replacement after an ordinary sequence gap.
  They cannot yet reject replay without a confirmed generation, because no
  generation exists to confirm.
- Adopting rule 4 is a wire-protocol change across host and follower: a new field on
  three server frames and one client frame, plus follower storage of the generation
  alongside its Y.Doc.
- Projectors and other doc consumers must keep handling `doc_reset` as an explicit
  lifecycle event rather than discovering a swapped doc instance implicitly.
- Until rule 4 ships, the ambiguous-gap risk is a known, accepted exposure rather
  than a latent unknown.

## Alternatives Considered

- **Wipe-and-refetch on every gap**: unambiguously safe against a lost `doc_reset`,
  but destroys the CRDT's reconnect value, breaks projector identity, and is a
  visible UX regression on ordinary transport loss. Rejected.
- **Buffer all frames indefinitely to avoid gaps**: unbounded memory, and gaps still
  occur on transport loss. Rejected.
- **Treat `workflow_id` as the lineage key**: already the follower's behaviour for
  cross-workflow subscribes, but `workflow_id` is stable across a host remint, so it
  cannot detect a lineage break within one workflow. Insufficient, which is why rule
  4 asks for a separate generation ID.

## References

- [ADR-CRDT-LAYOUT-0003: CRDT Layout Intent and Local Measurement](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
  — centralized layout management with CRDT.
- [ADR-GRAPH-DOCUMENT-0024: Graph Activation and Document Objects for In-App Agent Targets](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
  — owns the follower-document replacement rule this ADR builds on.
- [`docFrameClient.ts`](../../src/workbench/extensions/agent/crdt/docFrameClient.ts)
  — the frame parser and subscription encoder that rule 4 would extend.
- [`layoutFollowerBridge.ts`](../../src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts)
  — owns gap detection, the resubscribe, and the ordered reset-before-replacement
  lifecycle.

### Non-public history (not governing)

The decision was first recorded in the in-app agent program's private tracker, as
program ADR-019 and issue DQ-47. Those records are not readable from this
repository and confer no authority here; everything they settled that still governs
is restated above. They are listed only so the provenance is not silently dropped.
