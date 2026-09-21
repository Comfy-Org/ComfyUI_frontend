# ADR-CRDT-AUTHORITY-0035: Human Canvas Authority and Draft Reconciliation

Date: 2026-09-19

## Status

Proposed

## Context

The In-App Agent edits a shared per-workflow document that the frontend follows
([CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)).
Two channels carry the human's canvas to the server:

1. **Semantic operations.** While a chat is bound to the workflow and its tab
   is active, the mint ports turn canvas edits into `doc_ops`
   (`src/workbench/extensions/agent/crdt/mintPortWiring.ts`,
   `layoutMintPort.ts`, `opSender.ts`). The gate
   (`mintGate.ts`) is closed when no thread is bound: before the first turn
   acknowledges, and after "new chat". The sender drops queued operations as
   `undeliverable` when the binding changes or the transport stays refused.
2. **The turn draft.** Every turn whose target has a cloud workflow id, and
   every first turn of a new chat, posts the live canvas as `draft`
   (`src/workbench/extensions/agent/composables/agent/useAgentSession.ts`).
   The client sends `draft.content` only; the server derives the version it
   compares against from the document it already holds.

The server previously treated an existing document as permanently
authoritative over the posted draft. A user who cleared the canvas without
those deletions reaching the document (edited while unbound, or dropped at
unbind) then started a new chat on the same workflow and the agent read the
old nodes. This record assumes a backend change that makes the posted,
human-authored canvas authoritative over a divergent document, guarded by a
sequence check so it cannot erase a collaborator's later write and announced
to followers as a `doc_reset`. That change lives outside this repository:
nothing here can verify its status or semantics, so every claim about it
below is conditional until it is released. It needs nothing beyond the
`draft` field the client already sends.

The same symptom has a second, independent door. Scratch-tab bindings are
persisted so a restored unsaved draft reconnects to its thread after reload
(`agentWorkflowTabBindingStore.ts`). Every scratch tab shares one default
path, so a fresh blank scratch tab matched a persisted binding exactly like a
restored draft would, inherited that binding's `workflow_id` before the user
typed anything, and painted the old document onto the blank canvas. The posted
draft then agreed with the stale document, so no server-side reconciliation
could help: the frontend had resolved the wrong workflow. That door is closed
by
[AGENT-BINDING-0035](AGENT-BINDING-0035-document-identity-gates-persisted-workflow-tab-bindings.md),
which gates persisted bindings on document identity; this record only
depends on it.

## Decision

1. **The human's canvas is the authority for a human-authored turn.** The
   frontend always posts the live canvas as `draft` on the first turn of a chat
   and on every turn whose target has a cloud id. The server reconciles the
   shared document to that draft when they diverge. The frontend adds no
   "reset" flag or endpoint: the draft is the reset request. This contract is
   conditional on the backend change above; until it is promoted, "same
   document" means "whatever the document last held", and the reported flow
   still fails in production.
2. **A new chat on the same target keeps the same `workflow_id`.** Starting a
   chat neither rebinds the tab nor mints a workflow. Tests assert the new
   thread, the retained id and the cleared draft, not a different id.
3. **Operations are best-effort delivery; the draft is the reconciliation
   primitive.** The frontend does not persist or re-send operations dropped as
   `undeliverable`. Operations minted in one tick form one sender admission
   (`opCoalescer.ts`), which `OpSender` splits into the minimum number of
   wire-capped batches. Edits within the wire cap therefore take one round trip
   instead of N, narrowing the window in which a clear made while bound is lost
   at unbind. It does nothing for edits made while unbound; only the draft
   covers those.
4. **A lineage break settles pending human operations.** When `doc_reset`
   arrives for the bound document, the sender settles its queued batches
   `undeliverable` and a transmitted in-flight batch `unconfirmed` at once,
   symmetric to the unbind case. Those operations were minted against the old
   lineage and the draft that caused the reset already carries their effect.
   A result the host still returns for the transmitted batch is retired, not
   attributed: the sender reserves one late-result credit per transmission
   when it aborts a sent batch, as it already does after result silence, so
   the batch admitted after the reset settles only on its own result.
5. **The blank-tab door is closed by document identity, not by this
   record.** A persisted binding is adopted only by a tab whose workflow
   document id matches the one it was bound with, as decided in
   [AGENT-BINDING-0035](AGENT-BINDING-0035-document-identity-gates-persisted-workflow-tab-bindings.md).
   A blank, newly created scratch tab at the same path carries a fresh id,
   resolves to no workflow, and so neither subscribes to nor posts against
   the old document. This record adds no second gate; the contract here
   assumes that one.
6. **The server's sequence check is the guard against a stale canvas.** A
   human-authored draft posted from a canvas that missed follower frames (gap,
   disconnect) would revert agent work the user never saw. We rely on the
   sequence check the assumed backend change carries and record as a
   follow-up that the client should withhold `draft` while a bound follower
   is disconnected or in a gap.

Alternatives considered and rejected:

- _Mint a fresh `workflow_id` per chat._ Creates a second cloud workflow for a
  saved target and breaks reopening the chat from history.
- _Subscribe the follower and open the mint gate for the selected target
  regardless of thread state._ Closes the edit-while-unbound gap entirely, but
  it is the document-owned follower of
  [GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
  and re-keys every subscription; recorded as the direction, not this change.
- _Drain pending operations before unbinding on new chat._ Makes a synchronous
  command asynchronous and only covers a short race the draft already covers.
- _A client-side document reset request._ No wire primitive exists and the
  human-authored draft now has that meaning server-side.
- _Mark the tabs workflow persistence restores and let only a marked
  temporary tab adopt a persisted binding._ Considered here first; superseded
  before merge by the document-identity gate of AGENT-BINDING-0035, which
  refuses the same blank tab without a second store and also covers a tab
  restored into a browser with no session continuity.

## Consequences

### Positive

- One rule answers "what does the agent see": the canvas the human posted with
  the turn. The frontend contract is fully expressed in what it already sends.
- Same-target chats keep one document and one saved workflow; history,
  references and `open_tabs` keep working.
- The second door is closed on the frontend alone, by AGENT-BINDING-0035's
  identity gate: a blank scratch tab no longer inherits a stale binding,
  before or after the backend change.
- The e2e contract test asserts client obligations and one outcome (the
  cleared document stays empty across the re-subscribe), so it stays valid
  after the backend change lands.

### Negative

- Until the assumed backend change is released, the first door (a saved
  target whose document diverged from the cleared canvas) still fails in
  production; the frontend cannot fix it alone, and nothing in this
  repository can confirm when that happens.
- The stale-canvas risk in decision 6 is accepted, not removed, until the
  withhold-draft follow-up lands.
- Coalescing shares one batch's prefix-abort semantics across operations that
  were independent before: a host rejection of one operation leaves the later
  operations of that batch unapplied, where separate batches were independent.
  Chunking at the wire cap bounds a batch, and the ledger already models
  `unprocessed`.
- Human operations settled `undeliverable` or `unconfirmed` (at unbind, at
  `doc_reset`, on a dead transport) are still reported only to the dev panel;
  surfacing them to the user is a follow-up.
- Two browser tabs on the same document, both agent-bound, are out of scope:
  which tab's draft wins a divergence is decided by the server's sequence
  check, not by anything the frontend promises.

## Notes

"Replay" means two things across these records. Here, "the frontend does not
re-send dropped operations" is about the human write path. GRAPH-DOCUMENT-0024's
"replay safety" is about the read path: the follower catching up on missed
frames by state-vector delta. The write-path non-guarantee does not weaken the
read-path guarantee.

The server-side document replacement this record assumes is a `doc_reset`
lineage break, which GRAPH-DOCUMENT-0024 already sanctions as the sole
ordinary replacement path, not the whole-graph-replace mutation primitive that
CRDT-FOLLOWER-0025 rejects. As assumed here it is gated to a human-authored
divergence rather than routine edits and guarded against concurrent
collaborator writes by a sequence check. The follower's one-way invariant is
unchanged.

Relates to [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
(the human write path and the one-way follower invariant are unchanged),
[AGENT-BINDING-0035](AGENT-BINDING-0035-document-identity-gates-persisted-workflow-tab-bindings.md)
(the binding gate the blank-tab door relies on),
[GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
(the target-keyed follower this decision defers to), and
[AGENT-CONTEXT-0028](AGENT-CONTEXT-0028-separate-workflow-references-from-editor-tabs.md)
(`workflow_id` remains the pinned editable target; `open_tabs` is unchanged).
