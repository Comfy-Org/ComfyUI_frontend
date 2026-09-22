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
  live inputs. When every document input name exists in the live list, live
  order wins: matching inputs take the document's fields and live-only inputs
  remain in place. If any document input name is absent live,
  `mergeInputSlotsByName` falls back to positional preparation using the
  document's input list and order, dropping live-only inputs.

Incoming connect patches matching runtime slot instances and retains shared
array references. `LGraphNode` captures `_inputs`/`_outputs` at construction,
so reassigning the store's arrays would strand the reactive array the renderer
tracks, the rehydration proxy, and the slot-view WeakMap.

Authoritative snapshot reconciliation retains the arrays but can replace their
slot objects. It does not currently guarantee runtime slot identity or retention
of runtime-only metadata such as input widget markers and output labels. That
preservation gap remains separate follow-up work; this ADR does not claim it is
fixed by the incoming-connect path.

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

- FE-2504 must preserve named input targeting when replacing the current
  implementation. This ADR does not require retaining the store-first apply,
  materializer or reconciliation machinery that migration intends to delete.
- Existing document nodes preserve named targets through loading, growth, remote
  updates and save/reopen without rewriting the document.
- Reconcile semantics change for **every** node whose live inputs differ from the
  document's, not only autogrow nodes. When the live list contains every document
  input name, local-only slots persist, including stale or extension-added
  slots; this condition does not prove that autogrow caused the difference.
  Otherwise, the document's list and order replace the live list, so local-only
  slots are removed rather than preserved alongside appended document inputs.
- A connect naming an input that cannot be placed is rejected with a diagnostic
  return value rather than reaching the link store at slot `-1`.
- Duplicate input names on one node resolve to the first match. Nothing enforces
  name uniqueness at node registration or document ingestion, so this is an
  assumption, not a guarantee. Subgraph promoted inputs are the plausible source;
  see workspace `ADR-036`.
