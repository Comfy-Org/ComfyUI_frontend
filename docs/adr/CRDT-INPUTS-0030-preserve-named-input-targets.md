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

Rescoped 2026-10-23 by
[FE-3585](https://linear.app/comfyorg/issue/FE-3585): covers both directions.
`docOpMinter` now addresses a local link edit by input name in the bound
document instead of by live index, through the same module the applier uses,
and holds an edit on an input it grew until the document carries that input.
The durable on-wire addressing question still stays with #448.

## Context

The shared agent document addresses connections by numeric input slot. The
live node's inputs are produced by `node.configure()` plus `COMFY_AUTOGROW_V3`
growth, which reorder or insert local inputs (PM-993/PM-994). Live order then
differs from document order, so a link connected at the document's index lands
on the wrong live input: the MiniMax reference-to-video template loaded with
`width` on `length` and `height` on `ref_image_size`.

The same drift corrupts the outbound leg: a local link edit minted at its live
index lands on whichever document input occupies that index (#18332), and an
input the document lacks has no index at all until the host grows it.

This ADR covers both legs as they exist today: the projection (document to live
graph) and the mint (live edit to document operation). How a connection's
destination stays durably addressed on the wire when the input set changes is
governed by the Option A ruling in
[blocked-on-christian #448](https://github.com/christian-byrne/blocked-on-christian/issues/448)
and is out of scope here.

## Decision

The durable rule is to resolve document input targets onto live nodes by
**name** when their input orders differ. This rule does not require store-first
application or a separate reconciliation layer.

The rule lives in one place, `src/core/graph/widgets/documentSlots.ts`, which
both directions call: `LiveGraphApplier.#connectLink` resolves a document
link's `targetSlot` by reading the slot's `name` from the document node's
`inputs` entry and looking that name up in the live node's current `inputs`
(`resolveLiveInputSlot`), and `docOpMinter` addresses a live input by its name
in the document's input list (`documentInputSlot`). A document that names the
slot is never resolved positionally:
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

On the mint side, a live input the document lacks is grown rather than
addressed: a widget-backed socket, an autogrow member, or a dynamic-combo child
under the document's selection mints `connect` with `to_slot: null` and a
`grow` naming the input, and the host appends a slot for it. The minter does
not predict where that slot lands: the host may rename a grow whose name is
taken and re-ranks concurrent grows of one family by stamp, so neither the name
nor the index is known until the echo. A later edit on that input is held until
the document carries the input's name, then addressed by name like any other
edit. A connect and disconnect of the same unsent grow in one tick cancel each
other. A hold is dropped when its node is removed or cleared, when the session
unbinds or another document binds, or when the grow misses its catch-up
deadline, which reports the held edits instead of minting them. The deadline
restarts while the bound workflow's tab is suspended, as held ops do under
`CRDT-WRITE-0035`.

Outputs resolve the same way, by document slot name first and index second.
In practice outputs are never autogrown or reordered by growth, so a live index
still tracks the same document occupant it always did.

## Explicitly out of scope

- **Durable addressing on the wire.** Governed by #448 Option A. The minter
  still sends a document index resolved against the document it has seen, so
  that index can be stale by the time it applies when a concurrent producer
  reorders the node. Only carrying the input name on the wire and resolving it
  in the applier fixes that. A held edit is released by name, so if another
  producer grows the same name first, the edit addresses that producer's slot.
- **Synchronizing genuinely new inputs, and recovery UX for a connect that names
  an input neither side can place.** Follow-ups.
- **Migrating already-saved incorrect connections.** Private alpha; not migrated.

## Alternatives considered

- Predict the slot an unechoed grow will occupy and mint the dependent edit
  against it: rejected (`CRDT-FOLLOWER-0025`). It re-implements the host's grow
  naming and canonical ordering without the catalog the host uses, so a
  collision or re-rank sends the edit to another input, and a grow that never
  echoes keeps the prediction alive with no deadline.
- Restore document order after configure: later autogrow can move inputs again.
- Realign only initial links: leaves subsequent incoming edits wrong.
- Carry the input name on the wire and resolve in the applier: this is the right
  long-term answer, folded into the #448 Option A work rather than built
  separately here.

## Consequences

- An existing document node preserves named targets through loading, growth,
  remote updates and save/reopen without rewriting the document. A local link
  edit reaches the document input with the live input's name, not the one at
  its live index (#18332).
- A local edit whose target the minter cannot place by name, or whose held
  grow never lands, is reported once (`agent_crdt_link_slot_not_in_doc`) and
  not minted. The edit is lost from the document rather than applied to
  another input.
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
