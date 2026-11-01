# ADR-CRDT-STAMPS-0051: Human Ops Stamp Above What They Have Received

Date: 2026-10-30

## Status

Proposed

## Context

Widget values are last-writer-wins registers. The applier orders writes by
`[base_version, actor, op_id]`, and `base_version` is a creator-owned Lamport
counter (comfy-multi-player ADR-ORDERING-0005). The rule that makes such a
counter mean anything is that a producer stamps above every counter it has
received.

The human write leg did not follow it, in two ways:

- `opSender` stamped from the document sequence, not from the counters in the
  document. The two are different scales. The agent's batches are lifted above
  the document's highest counter (PM-2212), and one human batch advances the
  counter by its op count but the sequence by one, so the counter can run ahead
  of the sequence. An edit stamped below a counter this tab had already received
  lost to a write the person could see, and the host still counted it as
  handled.
- [CRDT-REPLAY-0039](CRDT-REPLAY-0039-retain-exhausted-operations-for-same-page-replay.md)
  retains an edit through an outage, but it kept the counter from before the
  outage. On reconnect the held edit arrived below anything the agent wrote
  meanwhile and was dropped. The widget hold had kept the canvas on the person's
  value, so canvas and document disagreed with no signal, until the next turn's
  draft replaced the document.

So a person's edit made during an outage did not win a conflict through the CRDT.
It either lost, or won only through the whole-document path of
[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md).

## Decision

1. **A counter is taken when an op is sent, not when it is queued.** The document
   sequence is a mint-time floor, not a value the stamp must exceed: a fresh
   sender at sequence 41 mints 41. At send, a human op stamps above the highest
   counter in the document the follower holds and above every counter this sender
   has already sent.
2. **An op the wire has not carried is re-stamped on its way out.** `op_id`, actor
   and payload do not change. No host can hold the old bytes, so this is not
   changed-payload reuse of an `op_id`. One shift moves the whole batch, so its
   internal order is kept, and later batches stay above it.
3. **An op the wire has carried is frozen.** A resend is byte-identical, which is
   what keeps it idempotent.
4. **A follower known to be behind does not send.** From a subscribe, socket
   drop, sequence gap or reset until the catch-up has been integrated, the sender
   holds, because a stamp taken before the catch-up cannot be above it. A deferred
   or failed projection does not hold it: the document is already current.
5. **A counter outside the safe integers is refused, never emitted.** The applier
   rejects a `base_version` outside them as `malformed_op` and aborts the rest of
   the batch, so emitting one loses that edit and every edit behind it. Both ends
   are bounded: an admission whose whole range would not fit is settled
   `undeliverable` under `counter_exhausted` without admitting unsafe envelopes
   or moving the sender's cursor. A held batch that cannot be lifted inside them
   is sent as minted, without an exhaustion-specific report. Stamping above what
   the follower has received is therefore a bounded guarantee.

The result for a value conflict: an edit the person made without seeing the
agent's write wins it if that edit had not reached the wire when the outage
began. A write made after the edit reached the document wins as usual. Only the
counter decides, apart from the existing tiebreak on an equal counter, so the
agent can still change a value the person set, and every replica computes the
same winner.

This is what the follower has received, not what the host holds. An edit sent
while an agent write is in flight back to this tab, inside one round trip, is
concurrent and can lose. That is ordinary last-writer-wins, online or not.

## Alternatives considered

- _Give human actors priority in the comparator._ Rejected. The agent could then
  never overwrite a value a person had set, which is the PM-2212 failure, and it
  needs a schema-wide change to the applier.
- _A vector clock, so a conflict policy can see real concurrency._ Rejected for
  now, as in the program's ADR-020: the per-participant state is not justified
  while one host admits every op.
- _Ask the host to lift human batches, as it does for the agent._ Rejected for
  unsent ops: the creator can stamp correctly itself, this keeps ordering in the
  op rather than the server, and the host lift needs replay-restoration
  bookkeeping that an unsent op does not. It stays an option for the frozen case
  below.
- _Use the package's `DocDerivedLamportClockStore`._ Rejected. Its transaction is
  asynchronous and writes a reservation into the document, which a follower must
  not do.
- _Keep the old stamp and let the draft repair the document._ Rejected. It turns
  an ordinary conflict into a lineage break.
- _Mint nothing until the socket is back._ Rejected. The sender owns `op_id` and
  order at mint, and holding graph operations elsewhere is the second queue
  CRDT-REPLAY-0039 refuses.

## Consequences

### Positive

- An offline edit wins through the CRDT, with no extra lineage break.
- An online edit can no longer lose to a counter its tab has already received.
- The widget hold ends with the document holding the held value, not with a
  silent disagreement.

### Negative

- A batch sent just before a connection dropped keeps its stamp, because it may
  have landed. If it did not, it can still lose to a concurrent agent write. That
  and the one-round-trip case above read the same to the frontend: the host
  reports a dropped write as `skipped`, like a replay, so the canvas can keep a
  value the document refused (FRONT-2834).
- `base_version` no longer equals the document sequence a batch was minted at.
  Nothing relied on that; the applier treats it as a counter.
- A follower that never finishes catching up holds its edits. They stay reported
  as unsynced. Delivery is not bounded in time (CRDT-RECONCILE-0035 requirement 3).
