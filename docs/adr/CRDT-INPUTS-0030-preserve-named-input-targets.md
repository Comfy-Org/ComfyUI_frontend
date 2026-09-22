# ADR-CRDT-INPUTS-0030: Project Document Inputs onto Reordered Live Nodes by Name

Date: 2026-09-09

## Status

Proposed

Rescoped 2026-09-19: covers the document-to-live projection direction only; the
durable destination question stays with blocked-on-christian #448 (see Context).

The store-first implementation described below is interim.
[FE-2504](https://linear.app/comfyorg/issue/FE-2504/agentcrdt-remove-store-first-remote-apply-and-every-reconciliation)
tracks its replacement with semantic `LGraph`/`LGraphNode` operations carrying
provenance, followed by removal of `graphMutations`, the materializer and their
reconciliation layers. That Backlog migration does not supersede this focused
fix or need to be implemented by this PR.

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

The durable rule is to resolve document input targets onto live nodes by
**name** when their input orders differ. This rule does not require store-first
application or a separate reconciliation layer.

The current interim implementation applies it at two boundaries:

- Initial materialization reuses ordinary loading's link realignment
  (`realignInputLinkSlots`), so a freshly materialized node's adapters follow the
  names the document named rather than the indexes it used.
- Incoming reconcile and connect resolve the document input name against current
  live inputs. A live-only input (one no document occurrence matches) is
  tolerated, and the live list otherwise wins, in two cases: it is a
  widget-promoted input slot (`input.widget` is set), since the wire format
  carries that value in `widgets_values` and never as a named input, so no
  document snapshot can list or drop one either way; or it classifies as an
  autogrow group member — via a live query answer, this follower's own
  remembered answer, the node type's static `COMFY_AUTOGROW_V3` definition, or
  the name-shape heuristic, in that order — and, unless the caller opts into
  `preserveLinkedAutogrow`, only when it is unlinked; `hasNonGrowthInputSetChange`
  is the single predicate both `mergeInputSlotsByName` call sites share. Any
  other live-only input — an ordinary extension-added slot, or a linked one
  where `preserveLinkedAutogrow` does not apply — means the input set changed,
  and `mergeInputSlotsByName` falls back to positional preparation using the
  document's input list and order for the whole node, dropping every live-only
  input rather than only the disqualifying one.

Incoming connect patches matching runtime slot instances and retains shared
array references. `LGraphNode` captures `_inputs`/`_outputs` at construction,
so reassigning the store's arrays would strand the reactive array the renderer
tracks, the rehydration proxy, and the slot-view WeakMap.

Authoritative snapshot reconciliation retains the arrays but can replace their
slot objects. It does not currently guarantee runtime slot identity or retention
of runtime-only metadata such as input widget markers and output labels. That
preservation gap remains separate follow-up work; this ADR does not claim it is
fixed by the incoming-connect path.

Outputs remain index-based: unlike inputs, they are never autogrown or
otherwise reordered by growth, so a live index still tracks the same document
occupant it always did. `patchLiveOutputSlots` also never reuses a live index
past the document's own output list, so a document that dropped an output
cannot resurrect it.

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

- FE-2504 must preserve named input targeting when replacing the current
  implementation. This ADR does not require retaining the store-first apply,
  materializer or reconciliation machinery that migration intends to delete.
- For the document-to-live projection this ADR covers, an existing document
  node preserves named targets through loading, growth, remote updates and
  save/reopen without rewriting the document, **provided the persisted
  document is already correctly named**. This ADR does not cover, and does not
  claim to fix, the outbound leg: minting a link by live position into the
  host document while the host document orders inputs by name can itself
  corrupt a node's persisted addressing before this projection ever reads it
  back. That corruption is tracked and reproduced separately at #18332.
- Reconcile semantics change for **every** node whose live inputs differ from the
  document's, not only autogrow nodes. A live-only slot persists only when it
  is widget-promoted or classifies as an autogrow group member (see
  Decision); neither condition proves the document omitted it on purpose,
  and the presence of every document name in the live list is not on its own
  enough to retain a live-only slot that fails both. Otherwise, the document's list and
  order replace the live list, so local-only slots are removed rather than
  preserved alongside appended document inputs.
- A connect naming an input that cannot be placed is rejected with a diagnostic
  return value rather than reaching the link store at slot `-1`.
- Duplicate input names on one node are consumed pairwise by occurrence, in
  document order: the Nth document occurrence of a name resolves against the
  Nth live occurrence of that name, not against the first live occurrence
  every time. Nothing enforces name uniqueness at node registration or
  document ingestion, so relying on more live occurrences of a name than the
  document supplies is an assumption, not a guarantee. Subgraph promoted
  inputs are the plausible source; see workspace `ADR-036`.
