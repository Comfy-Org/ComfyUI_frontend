# ADR-CRDT-INPUTS-0030: Preserve Named Input Targets Across Agent Edits

Date: 2026-09-09

## Status

Proposed

## Context

The shared agent document addresses connections by numeric input slot. Node
configuration and later autogrow can change local input order (PM-994).
A document index therefore cannot identify the same local input throughout a
node's lifetime.

## Decision

Use input names to translate indexes at the existing CRDT boundaries. Initial
materialization reuses ordinary loading's link realignment. Subsequent incoming
connects resolve the document input name against current local inputs. Human
connects resolve the current input name against the document before the sender
captures the operation; queued operations and retries retain that result.
Outputs remain index-based because their names need not be unique.

Remote slot projection retains runtime slot instances and shared array references.
Plain serialized records still receive their legacy connectivity mirrors; runtime
slots derive connectivity from the link store.

## Alternatives considered

- Restore document order after configure: later autogrow can move inputs again.
- Realign only initial links: leaves subsequent incoming and outgoing edits wrong.
- Add a resolver through every mint-port layer: the existing human enqueue
  boundary already owns the graph and follower at the required synchronous time.

## Consequences

- Existing document nodes preserve named targets through loading, growth, remote
  updates, local reconnects, and save/reopen without rewriting the document.
- A missing input name on an existing document node rejects the outgoing connect
  with a divergence diagnostic instead of sending a local index.
- Entirely new local nodes awaiting their add-node echo retain the existing
  connect path. General pending-node/autogrow synchronization and recovery UX
  remain follow-ups. Already-saved incorrect connections are not migrated.
