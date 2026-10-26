# ADR-CRDT-REPLAY-0039: Retain Exhausted Operations for Same-Page Replay

Date: 2026-09-28

## Status

Proposed

## Context

The in-app agent's `opSender` owns the ordering and identity of locally minted
human operations. A temporary transport failure can exhaust its retry budget
without proving that the edit should be abandoned. If exhaustion settles and
discards the operation, reconnecting in the same page session cannot deliver
the user's edit even though the sender and its original operation identity are
still alive.

[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md)
currently says that operations dropped as `undeliverable` are neither persisted
nor resent, and its Notes describe this as a write-path non-guarantee. That is
too broad for transport retry exhaustion: it conflates a delivery budget with
the lifetime of the user's edit.

This proposal records only the same-page-session policy. It does not decide
whether pending operations survive a full page reload.

## Decision

Within one page session, `opSender` retains a locally minted operation after
transport retries are exhausted. Transport retry exhaustion is not terminal
discard.

Closing or remounting the agent panel does not end the page session and must
not discard a retained operation. Sender teardown must first transfer every
retained operation, unchanged and in order, to a page-session owner from which
the next sender instance can resume it. An implementation may instead make the
sender itself page-session-owned so panel teardown does not detach it. The
current panel-owned sender does neither: `useAgentCrdtFollower` creates it in
the panel's effect scope, scope disposal calls `sender.detach()`, and
`detach()` clears the in-flight batch, queue, and open admission group without
settlement. That is an implementation gap, not a narrower lifetime contract.

After the transport reconnects and the workflow subscription is acknowledged,
`opSender` replays the retained operation. Replay uses the operation's
original `op_id`; it never re-mints identity. The normal host result remains
the authority for settlement, and duplicate delivery remains safe through
that stable identity.

If accepted, this decision supersedes CRDT-AUTHORITY-0035 Decision 3 and its
Notes only where they classify transport retry exhaustion as terminal
`undeliverable` delivery. It does not change that record's behavior for an
unbind, workflow retarget, or `doc_reset` lineage break. It also does not add a
second retry queue: retention and replay stay inside `opSender`, which already
owns ordering and identity. A page-session owner used only to preserve the
same sender state across panel instances is lifecycle ownership, not a second
delivery queue.

Persistence across a full page reload remains undecided. This decision neither
requires browser storage nor promises delivery after the page session ends.

### Alternatives considered

- **Discard after the transport retry budget.** Rejected because retry
  exhaustion says the transport did not produce a result; it does not express
  the user's intent to abandon the edit.
- **Re-mint the operation on reconnect.** Rejected because a new `op_id` would
  defeat idempotence and could apply the same edit twice.
- **Store exhausted operations in a separate retry queue.** Rejected because
  it would duplicate the ordering and identity responsibilities already owned
  by `opSender`.
- **Require persistence across page reload now.** Deferred. It needs a separate
  decision about storage, cleanup, and user-visible failure semantics.

## Consequences

### Positive

- A temporary disconnect does not silently discard an edit while the same
  page session is still alive.
- Replays keep the original `op_id`, preserving idempotence across uncertain
  delivery outcomes.
- Retention remains in the component that owns operation ordering and identity.

### Negative

- `opSender` can retain exhausted operations in memory for the rest of the page
  session. Panel teardown must preserve or transfer that state, while page
  teardown may discard it because reload persistence remains undecided.
- This does not protect an edit across a full page reload.
- Until runtime support lands, this is a policy contract rather than a claim
  about current behavior.

## Notes

Christian Byrne approved the product direction on 2026-09-26:

> yes we definiteliy want queued and replay edits. edits while connection is
> down should definitely still be pushed eventually. if adrs are saying
> otherwise, change the adrs as well.

On 2026-09-28, Christian clarified that the suspended-tab resume case is
required within the same page session, retention belongs in `opSender`, replay
keeps the original `op_id`, and persistence across a full page reload remains
undecided. The program operator recorded that clarification as Accepted
ADR-012 at immutable commit `955f4dd3eab7e3a6992e409239463ddc5fa5c296`.

The program repository is private to some frontend reviewers, so its
[immutable record](https://github.com/christian-byrne/in-app-agent-program/blob/955f4dd3eab7e3a6992e409239463ddc5fa5c296/decisions/ADR-012-lifecycle-and-reconnect-semantics.md)
is provenance, not required reading. The approval and complete normative
policy are transcribed above and in this proposal. This frontend ADR remains
Proposed until frontend maintainers independently ratify it.
