# ADR-CRDT-INPUTS-0030: Project Document Inputs onto Reordered Live Nodes by Name

Date: 2026-09-09

## Status

Proposed

Rescoped 2026-09-19: covers the document-to-live projection direction only; the
durable destination question stays with blocked-on-christian #448 (see Context).

## Context

The shared agent document addresses connections by numeric input slot. The
follower builds link adapters at those document indexes before `node.configure()`
runs, and configure plus `COMFY_AUTOGROW_V3` growth reorder or insert local
inputs (PM-993/PM-994). Live order then differs from document order while the
adapters still point at document indexes, so the MiniMax reference-to-video
template loaded with `width` on `length` and `height` on `ref_image_size`.

This ADR covers the **projection** direction only: document to live graph. The
inverse question — how a connection's destination stays durably addressed when
the input set changes — is already governed by the Option A ruling in
[blocked-on-christian #448](https://github.com/christian-byrne/blocked-on-christian/issues/448)
and is deliberately out of scope here.

## Decision

Project document inputs onto live nodes by **name**, at the two boundaries where
document order and live order can disagree:

- Initial materialization reuses ordinary loading's link realignment
  (`realignInputLinkSlots`), so a freshly materialized node's adapters follow the
  names the document named rather than the indexes it used.
- Incoming reconcile and connect resolve the document input name against current
  live inputs. Live order wins over document order: a live slot the document also
  names takes the document's fields, a live slot the document omits (a
  runtime-grown input) stays where it is, and a document slot the live node lacks
  is appended.

Remote slot projection retains runtime slot instances and shared array
references, because `LGraphNode` captures `_inputs`/`_outputs` at construction
and reassigning the store's arrays strands the reactive array the renderer
tracks, the rehydration proxy, and the slot-view WeakMap.

Outputs remain index-based because their names need not be unique.

## Explicitly out of scope

- **Producer-side translation of local indexes to document indexes before mint.**
  Governed by #448 Option A. It is also the shape `ADR-031` rejected
  ("document-state-dependent, races between concurrent producers, and breaks
  opposite-order convergence"), and it is unsound under `RUL-156`, whose
  canonical grow ordering permutes slot names and rewrites link-tuple target
  indexes — so a producer-resolved index can be stale by the time it applies,
  with no detector. Durable addressing belongs on the wire and in the applier;
  see workspace `ADR-036` D2.
- **Synchronizing genuinely new inputs, and recovery UX for a connect that names
  an input neither side can place.** Follow-ups.
- **Migrating already-saved incorrect connections.** Private alpha; not migrated.

## Alternatives considered

- Restore document order after configure: later autogrow can move inputs again.
- Realign only initial links: leaves subsequent incoming edits wrong.
- Carry the input name on the wire and resolve in the applier: this is the right
  long-term answer and is recorded as workspace `ADR-036` D2, folded into the
  #448 Option A work rather than built separately here.

## Consequences

- Existing document nodes preserve named targets through loading, growth, remote
  updates and save/reopen without rewriting the document.
- Reconcile semantics change for **every** node whose live inputs differ from the
  document's, not only autogrow nodes: stale local-only slots now persist, and
  document slots the live node lacks are appended at the end rather than in
  document order.
- A connect naming an input that cannot be placed is rejected with a diagnostic
  return value rather than reaching the link store at slot `-1`.
- Duplicate input names on one node resolve to the first match. Nothing enforces
  name uniqueness at node registration or document ingestion, so this is an
  assumption, not a guarantee. Subgraph promoted inputs are the plausible source;
  see workspace `ADR-036`.
