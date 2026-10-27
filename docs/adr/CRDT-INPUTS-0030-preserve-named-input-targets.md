# ADR-CRDT-INPUTS-0030: Project Document Inputs onto Reordered Live Nodes by Name

Date: 2026-09-09

## Status

Proposed

Rescoped 2026-09-19: covers the document-to-live projection direction only; the
durable destination question stays with blocked-on-christian #448 (see Context).

Revised 2026-09-24 by
[FE-2504](https://linear.app/comfyorg/issue/FE-2504/agentcrdt-remove-store-first-remote-apply-and-every-reconciliation):
the store-first implementation this ADR first described (`mergeInputSlotsByName`,
`nodeStore.replaceNodeSlots`, the reconcile-time slot merge) was deleted with the
store-first follower. The rule is unchanged; the Decision below describes where
it now lives.

## Context

The shared agent document addresses connections by numeric input slot. The
live node's inputs are produced by `node.configure()` plus `COMFY_AUTOGROW_V3`
growth, which reorder or insert local inputs (PM-993/PM-994). Live order then
differs from document order, so a link connected at the document's index lands
on the wrong live input: the MiniMax reference-to-video template loaded with
`width` on `length` and `height` on `ref_image_size`.

This ADR covers the **projection** direction only: document to live graph. The
inverse question — how a connection's destination stays durably addressed when
the input set changes — is already governed by the Option A ruling in
[blocked-on-christian #448](https://github.com/christian-byrne/blocked-on-christian/issues/448)
and is deliberately out of scope here.

## Decision

The durable rule is to resolve document input targets onto live nodes by
**name** when their input orders differ. This rule does not require store-first
application or a separate reconciliation layer.

The rule lives in one place: `LiveGraphApplier.#connectLink`
(`src/workbench/extensions/agent/crdt/liveGraphApplier.ts`) resolves a document
link's `targetSlot` by reading the slot's `name` from the document node's
`inputs` entry and looking that name up in the live node's current `inputs`
(`resolveSlot`). A document that names the slot is never resolved positionally:
a name the live node lacks is a real mismatch, and the link is left unresolved
(and reported once) rather than connected to whatever occupies that index. Only
a document entry without a name falls back to its index, and only when that
index exists live.

The live input set itself is never merged or replaced by the follower. A node
is created by `node.configure()` from the document's serialized node with its
link fields detached; configure, autogrow, and extensions produce the live
inputs exactly as they do for a human-loaded workflow. On a later document
change the applier patches title, mode, flags, properties, appearance, and
widget values in place (`SYNCED_NODE_FIELDS`) and leaves `inputs`/`outputs`
alone: slots follow links. A node whose document `type` changed is removed and
recreated, then its incident document links are reconnected by name.

Outputs resolve the same way, by document slot name first and index second.
In practice outputs are never autogrown or reordered by growth, so a live index
still tracks the same document occupant it always did.

## Explicitly out of scope

- **Producer-side translation of local indexes to document indexes before mint.**
  Governed by #448 Option A. Producer-side translation depends on document
  state, races between concurrent producers, and breaks opposite-order
  convergence. Canonical grow ordering can permute slot names and rewrite
  link-tuple target indexes, so a producer-resolved index can be stale by the
  time it applies, with no detector. Durable addressing belongs on the wire
  and in the applier.
- **Synchronizing genuinely new inputs, and recovery UX for a connect that names
  an input neither side can place.** Follow-ups.
- **Migrating already-saved incorrect connections.** Private alpha; not migrated.

## Alternatives considered

- Restore document order after configure: later autogrow can move inputs again.
- Realign only initial links: leaves subsequent incoming edits wrong.
- Carry the input name on the wire and resolve in the applier: this is the right
  long-term answer, folded into the #448 Option A work rather than built
  separately here.

## Consequences

- For the document-to-live projection this ADR covers, an existing document
  node preserves named targets through loading, growth, remote updates and
  save/reopen without rewriting the document, **provided the persisted
  document is already correctly named**. This ADR does not cover, and does not
  claim to fix, the outbound leg: minting a link by live position into the
  host document while the host document orders inputs by name can itself
  corrupt a node's persisted addressing before this projection ever reads it
  back. That corruption is tracked and reproduced separately at #18332.
- Live-only inputs (autogrow spares, extension-added slots, widget-promoted
  inputs) are never pruned by a document change, because the follower does not
  write the input set at all. A document that drops an input leaves the live
  slot in place, unlinked; the document's links still resolve by name onto the
  inputs it does list.
- A connect naming an input that cannot be placed is left unresolved and
  reported once (`agent_graph_link_unresolved`) rather than connected at a
  guessed index; if a stale live link carried the same id it is removed.
- Duplicate input names on one node resolve to the **first** live occurrence
  (`Array.prototype.indexOf`), not pairwise by occurrence. Nothing enforces name
  uniqueness at node registration or document ingestion; subgraph promoted
  inputs are the plausible source of duplicates. Pairwise resolution is a
  follow-up if a real node exhibits it.
