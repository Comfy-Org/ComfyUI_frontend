# ADR-CRDT-RECOVERY-0029: Lineage-Gated Replay for Sequence-Gap Recovery

Date: 2026-08-28

## Status

Proposed

## Context

The in-app agent's CRDT follower integrates Yjs updates from one authoritative doc
host. Every `doc_update` carries a sequence number, so transport loss can leave a
gap.

### What the follower does today

`layoutFollowerBridge.ts` detects a gap by comparing a `doc_update`'s `seq` with
the last applied one, or with the subscribe acknowledgement before the first
update. It withholds the uncertain frame and resubscribes with the state vector of
the **existing** follower Y.Doc. It replaces that doc only on a lineage break: an
explicit `doc_reset`, including the reset it synthesizes after a re-minting or
conflicting `doc_reseed_result`, or a subscribe that names a different
`workflow_id`. A sequence gap never replaces it.

That is the rule
[ADR-GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
records, and this ADR does not change it.

### Why that rule is not sufficient on its own

A gap does not reveal which frame was lost. The missing frame may itself have been
a `doc_reset`. Yjs state vectors identify known structs, not document lineage, and
`workflow_id` is stable across a host remint. If the follower applies the new
lineage's catch-up to its old Y.Doc, the result keeps structs from the old lineage
that the replacement document never deleted.

The host already sends the identity needed to detect this. `lineage_seq` is the
sequence number at which the host's current Y.Doc lineage began. It changes only
when the host re-mints the document. The generated contract in
`@comfyorg/ingest-types` requires it on `doc_update` and `doc_reset`. The host also
returns it on a successful `doc_subscribed` and accepts the follower's
`known_lineage_seq` on `doc_subscribe`. When the known value is absent or stale, the
host ignores the follower's state vector and returns the whole current document.

**The frontend does not use that identity yet.** `docFrameClient.ts` parses
`lineage_seq` only on `doc_reset`, does not read it from `doc_update` or
`doc_subscribed`, and does not send `known_lineage_seq`. The follower therefore
cannot distinguish a missed reset from an ordinary gap. Using the existing field
is what this ADR asks for.

## Decision

### Current rule (implemented)

1. On a sequence gap or reconnect, the follower withholds the uncertain frame and
   resubscribes with its current state vector.
2. The follower keeps its existing Y.Doc and applies the returned catch-up to it.
3. A lineage break is the only path that replaces the follower doc: an explicit
   `doc_reset`, including the reset synthesized after a re-minting or conflicting
   `doc_reseed_result`, or a subscribe naming a different `workflow_id`. The reset
   MUST be dispatched to every projector and consumer before replacement, and the
   next subscribe MUST start from an empty state vector.

Rules 1-3 restate ADR-GRAPH-DOCUMENT-0024's replacement rule. **This ADR supersedes
no clause of it.**

### Required follower change (not implemented)

4. The follower MUST store the `lineage_seq` of the Y.Doc it holds, send it as
   `known_lineage_seq` on `doc_subscribe`, and read `lineage_seq` from every
   `doc_update`, `doc_reset`, and successful `doc_subscribed`.
5. Once rule 4 ships, gap recovery gains a second replacement trigger: a newer
   `lineage_seq` than the follower's is a lineage break and takes the same ordered
   reset-before-replacement path as rule 3. A `doc_update` with an older
   `lineage_seq` belongs to a replaced document and is discarded.
   ADR-GRAPH-DOCUMENT-0024 is amended at that point, not before.
6. Until rule 4 ships, the follower cannot resolve a gap's ambiguity. Replay is the
   accepted behaviour, and the residual risk that the lost frame was a `doc_reset`
   is accepted knowingly rather than traded for a wipe on every gap.

Rule 5 compares lineage values. It does not make a frame without `lineage_seq` a
lineage break; doing so would replace the follower doc on every gap from a host
that predates the field.

### Defects

- Replacing the follower doc after an ordinary sequence gap is a defect.
- Once rule 4 ships, applying an update from a different lineage to the existing
  doc is a defect.

### Deferred contracts

This ADR does not define transport-cursor recovery, reset precedence, or the
replacement-completion barrier. Those contracts are open and are not settled by
any record this ADR relies on.

## Consequences

- Reviews of sync/reconnect code reject replacement after an ordinary sequence gap.
  They cannot yet reject replay without a confirmed lineage, because the follower
  does not check `lineage_seq`.
- Adopting rule 4 is a follower change: the host already sends `lineage_seq` and
  accepts `known_lineage_seq`. The follower must store the value with its Y.Doc and
  compare it on updates and subscribe acknowledgements.
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
  4 uses `lineage_seq`.

## References

- [ADR-CRDT-LAYOUT-0003: CRDT Layout Intent and Local Measurement](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
  — centralized layout management with CRDT.
- [ADR-GRAPH-DOCUMENT-0024: Graph Activation and Document Objects for In-App Agent Targets](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
  — owns the follower-document replacement rule this ADR builds on.
- [`docFrameClient.ts`](../../src/workbench/extensions/agent/crdt/docFrameClient.ts)
  — the frame parser and subscription encoder that rule 4 would extend.
- [`types.gen.ts`](../../packages/ingest-types/src/types.gen.ts)
  — the generated `DocUpdateData` and `DocResetData` contracts that require
  `lineage_seq`.
- [`layoutFollowerBridge.ts`](../../src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts)
  — owns gap detection, the resubscribe, and the ordered reset-before-replacement
  lifecycle.

### Non-public history (not governing)

The decision was first recorded in the in-app agent program's private tracker, as
program ADR-019 and issue DQ-47. Those records are not readable from this
repository and confer no authority here; everything they settled that still governs
is restated above. They are listed only so the provenance is not silently dropped.
