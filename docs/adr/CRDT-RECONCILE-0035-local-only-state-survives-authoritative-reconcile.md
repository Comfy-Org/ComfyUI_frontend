# ADR-CRDT-RECONCILE-0035: Local-Only State Survives Remote Apply

Date: 2026-09-19

Revised after the graph-API apply path landed (#18700).

## Status

Proposed

## Relationship to existing ADRs

This record owns two things: the four behavior requirements that any remote
apply of the agent document must keep satisfying, and the gaps where main
does not satisfy them yet. The mechanism itself is decided elsewhere.

- **[CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)**
  owns the apply path: the document is applied through the graph API, nothing
  sweeps the live graph against the document, a frame written by this tab is
  dropped on entry, a rejected op is reverted register by register, and
  in-flight widget writes are held. This record does not restate those
  decisions; it states which guarantees follow from them.
- **[CRDT-WRITE-0035](CRDT-WRITE-0035-hold-pending-human-ops-across-tab-suspension.md)**
  decides that a tab-inactive suspension parks the sender instead of dropping
  it. The rebind reconcile it guarded no longer exists, so its reconcile text
  is historical.
- **[CRDT-REPLAY-0039](CRDT-REPLAY-0039-retain-exhausted-operations-for-same-page-replay.md)**
  owns retention and replay of operations the sender gave up on. It is the
  live residue of the earlier idea that pending intent should outlive the
  panel, and this record defers to it for that.
- **[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md)**
  decides that a `doc_reset` settles every queued and in-flight human op and
  that the human-authored draft is the reconciliation primitive. It records
  that `unconfirmed` and `undeliverable` outcomes reach only the dev panel;
  surfacing them is a follow-up owned here.
- **[CRDT-FOLLOWER-0035](CRDT-FOLLOWER-0035-bounded-ack-timeout-retry-for-unacknowledged-doc-subscribe.md)**
  decides the bounded resubscribe retry on an unacknowledged `doc_subscribe`.
  That retry never touches the sender, so it neither settles nor re-sends
  human ops.
- **[GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)**
  decides same-lineage state-vector replay and that `doc_reset` is the only
  event that replaces a document lineage.

## Context

The in-app agent and the human edit one workflow through a shared document.
The human's edits travel as ops over a write leg that can lose them: the tab
goes inactive, the socket drops, the host refuses or never answers. At the
same time the host streams the document back, including echoes of the
human's own accepted ops. Whatever applies those frames to the live canvas
must not destroy an edit the human made that the document has not yet
accepted, must not hide a refusal, and must not leave a lost edit looking
like a successful one.

This record was first written against an architecture that diffed the whole
document against the live graph on rebind and so needed machinery to protect
local-only state from that diff. #18700 replaced that architecture with an
apply path that is driven by the change delta of each frame. The protection
is now mostly structural rather than predicate-based. The four requirements
survive the change, and they are worth keeping as an explicit contract
because the structure that satisfies them is easy to break by accident (for
example by adding a sweep or a full re-projection), and because two of them
are not satisfied at all.

## Decision

The document is authoritative for what it has told the live graph, not for
what it has never seen. A remote apply may change only what the document
changed. Four requirements follow, and they are the regression contract for
any change to the apply path.

1. **Pending local intent is never silently discarded by a remote apply.** A
   node, link or widget value the human changed locally, and that the
   document has not yet accepted, is not removed, recreated or overwritten by
   a frame that does not name it. The requirement covers every state the
   carrying op can be in, including after it has timed out.
2. **A host rejection is reported.** When the host explicitly refuses a human
   op, the user is told and the refused registers are put back to the
   document's value.
3. **An edit whose delivery is unknown reaches a visible terminal outcome
   within a bounded time.** Absence from the document never reverts an edit,
   and an acknowledgement alone never settles one: only an explicit host
   rejection reverts.
4. **A collision the available provenance can identify is reported, and the
   document wins.**

How well main holds each one:

- **Hold.** Requirement 2 holds for every op kind. Requirement 1
  holds by construction in merge mode, which is every apply except the first
  one after a `doc_reset`.
- **Hold only partially.** A `doc_reset` replace removes local-only nodes and
  links without a report. A widget hold lifts when its op settles, including
  when the op timed out, not when the document confirms the value. Time is
  bounded for requirement 3 only while the tab is active.
- **Do not hold.** No visible outcome exists for an edit that ends
  `unacknowledged`, `unconfirmed` or `undeliverable`. A rejection that
  arrives after the sender gave up is swallowed. A same-id collision with
  another writer is not reported.

A per-op protected set of the kind this record once proposed is not
reintroduced. Pending intent is protected by construction, because a frame
can change only what the document changed. A set of that shape comes back
only if one of the gaps below cannot be closed without it, and then as a
small registry in the sender keyed by op id, not as a second source of op
identity (see the follow-ups).

## Mechanism on main

All of this lives under `src/workbench/extensions/agent/crdt/`.

### Apply modes

`LiveGraphApplier` (`liveGraphApplier.ts`) has two modes. In merge mode it
applies only what the frame's collected change delta names, as recorded by
`DocChangeCollector` (`docChangeCollector.ts`) per node, widget and link. It
never removes a live node or link the document merely lacks. A node the
human deleted locally is not brought back by a later frame, because field
and widget syncs need a live node, and only an `add` delta creates one. A
node whose op is queued, parked or timed out is therefore left alone.

Replace mode runs only for the first applied frame after a `doc_reset`. The
follower arms it through `AgentCrdtProjection.replaceOnNextFrame`
(`agentCrdtProjection.ts`), and the only caller is the reset handler in
`useAgentCrdtFollower.ts`. In replace mode the applier first removes every
live node and link the new lineage lacks, with no report. Tab return,
reconnect, rebind and collected-delta application all use merge. While a tab
is inactive the projection stays bound and the collector keeps accumulating,
and the accumulated delta is applied on reactivation.

Pins: `agentCrdtProjection.integration.test.ts` (replace removes a local-only
node only once the new lineage's first frame arrives),
`agentCrdtProjection.localEdits.test.ts` (an unminted add and a node the
document never took survive tab return),
`useAgentCrdtFollower.humanAddTabSwitch.test.ts`,
`agentDeleteTabSwitchRace.test.ts`, and the Playwright specs
`agentHumanAddTabSwitch.spec.ts`, `agentHumanDeleteTabSwitch.spec.ts`,
`agentHumanAddReload.spec.ts` and `agentFirstMintResetSweepsTemplate.spec.ts`
(a reset alone sweeps nothing).

### Human write leg

Human edits become graph intents, `docOpMinter.ts` mints them into wire ops
(add node, remove node, connect, disconnect, clear, set widget, set node
field), and `opSender.ts` sends them one batch at a time, in order. Only the
bound document's root graph is mintable; an op for another graph, or for the
interior of a subgraph, is not minted and is reported once. A batch ends in
exactly one of four outcomes:

| Outcome          | Produced when                                                                                                                           | Time bound                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `acknowledged`   | a result arrives for the batch's op ids (an anonymous failure also counts when a send happened)                                         | none, the result decides                         |
| `unacknowledged` | no result within the result timeout, after one silent resend of the same ops                                                            | about 20 seconds from the first send, tab active |
| `unconfirmed`    | the batch was sent, then the sender was unbound, aborted by a `doc_reset`, detached, or its subscribe was refused                       | immediate on the event                           |
| `undeliverable`  | the batch was never sent (queued or detached), or the transport refused it for the whole retry budget (five tries, half a second apart) | about 2.5 seconds of retry, or immediate         |

A suspension parks the batch instead of sending or settling it. A resume
sends it again, unless the sender is now bound to a different workflow, in
which case it settles `unconfirmed` or `undeliverable`. A `doc_reset` aborts
everything the sender holds before the reset is announced, and unmounting the
panel detaches the sender, which settles whatever is still outstanding.
After a batch settles without an answer, the sender keeps one credit per
outstanding send so that a late result drains a credit instead of being
mistaken for the result of a later batch.

Pins: `opSender.test.ts` (resend then `unacknowledged`, late results,
suspension, retarget, `abortAll` ordering) and `crossWorkflowPending.test.ts`
(a result for another workflow is never re-addressed).

### Rejection path

For an `acknowledged` outcome with `ok: false`, the follower
(`useAgentCrdtFollower.ts`) reports the rejection through `reportError` when
the host names a failure, and asks the projection to revert the ops. Ops
count as rejected when the host did not list them as applied.
`AgentCrdtProjection.revertRejected` reads
each refused op's node, widget or link register back from the document
(`rejectedOpChanges.ts`) and applies it under its own revert actor: a refused
add is removed, a refused delete or clear is restored together with its
links, a refused widget write resyncs the widget, and a refused connect or
disconnect resyncs the link. Edits inside a subgraph interior are skipped.
Nothing else in the live graph is touched, so a rejection never widens into a
reconcile.

The user sees a toast from `rejectedOpNotice.ts`. Copy is chosen from four
keys under `agent.editRejected` (widget write or generic, complete or
partial), and a toast with identical rendered text is throttled for ten
seconds. Telemetry records each distinct rejection code once per follower.

Pins: `useAgentCrdtFollower.test.ts` (only host-rejected ops revert),
`useAgentCrdtFollower.rejectedWidgetWrite.test.ts` and
`useAgentCrdtFollower.rejectedHumanAdd.test.ts` (toast, throttle, telemetry),
and `agentCrdtProjection.localEdits.test.ts` (revert per op kind).

### Echo and collision

A frame whose actor is this tab and that is not a catch-up replay is dropped
on entry: it takes the pending delta, settles widget holds against the
document, and applies nothing. The graph already holds that edit because the
intent was minted from it. Catch-up frames are exempt because they can carry
this actor as last writer while replaying state the graph never saw.

Any other frame that names an id the graph already holds wins without a
report. A live node of the same type is updated from the document, and a live
node of a different type is removed and recreated with its links, so the
document wins either way. The one related report is for a created node whose
live id differs from the document's.

Collisions are mostly avoided rather than detected. A graph bound to a
document mints node ids from a range disjoint from the ids the agent mints
(`idAllocation.ts`, the `crdt-disjoint` mode), so ids minted while bound
cannot collide. Ids that were minted sequentially before binding are the
residue. `agentNodeIdCollision.spec.ts` pins the remaining failure as an
expected failure.

### Widget in-flight hold

`LocalWidgetWrites` (`localWidgetWrites.ts`) remembers the latest local value
of each widget register whose op has not been confirmed. A remote frame that
writes such a register is held back, because the host built it before the
local write arrived and applying it would rewind what the user typed. The
hold lifts when the document catches up (an own-actor echo), when a settled
op carries the register's latest value, or on a `doc_reset`. The follower
settles holds for every outcome state, so a timed-out write stops being held
and the next remote value overwrites the local one. This is the one place
where the first requirement is bounded by sender settlement instead of by
confirmation.

### Blueprint definitions

A blueprint insert creates a node whose type depends on a subgraph
definition. The human path mints it as an ordinary add-node op with the node
snapshot; it does not mint a `define_subgraph` op, though the wire package
carries one, and the minter has no path for it. The document therefore never
learns the definition from a human insert. The applier reads definitions out
of the document but nothing writes the human's. Edits inside a subgraph
interior are not representable and are reported once per kind
(`agent_crdt_unrepresentable_subgraph_*`), so a bound document can diverge
from the local graph there.

## Requirements

| Requirement                  | Holds today        | How                                                                         | Remaining                                                                        |
| ---------------------------- | ------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Pending intent is kept       | Mostly             | Merge mode applies only the delta; replace is armed only by `doc_reset`     | Replace sweeps silently; widget hold lifts on any settlement                     |
| A rejection is reported      | Yes                | Register-wise revert plus a throttled toast, for every op kind              | A rejection that arrives after the sender gave up is not seen                    |
| Delivery-unknown is visible  | Bounded, not shown | Four sender outcomes; about 20 seconds when active, immediate on unbind     | No user-visible outcome; no late correlation; no bound while the tab is inactive |
| A collision is reported      | No                 | Own-actor echo drop and disjoint id minting avoid most; the document wins   | Same-id merge or recreate is silent                                              |
| Blueprint definitions arrive | No                 | Interior edits are reported; the host node is minted without its definition | Mint `define_subgraph` from the human path                                       |

## Remaining gaps and follow-ups

Ordered by how much of a requirement each closes. Of the slices in the
earlier plan, A0 (refuse to mint for a graph that is not the bound root) is
done (`isMintableRootScope`), A, A1 and B are moot, and C (the blueprint mint)
is still open.

1. **Surface and correlate terminal non-ack outcomes.** The follower records
   `unacknowledged`, `unconfirmed` and `undeliverable` only in the dev panel
   (and only with debug on). They need a user-visible notice under its own key
   (distinct from `agent.editRejected`), throttled the same way, and
   telemetry. Today a node whose add timed out stays in the graph, and a
   delete that never arrived stays deleted locally while the document keeps
   the node; the notice makes that divergence visible. The sender must also
   keep a settled op's identity long enough that a late result is processed
   instead of swallowed: a late rejection should revert and report, a late
   acknowledgement should clear the notice. If that needs per-op state, the
   smallest form is a bounded registry of settled ops keyed by op id inside
   the sender, with no second owner of op identity.
2. **Retention across the panel lifetime.** Held batches have no deadline
   while the tab is inactive and die with the panel. This is
   CRDT-REPLAY-0039; do not duplicate it here.
3. **Report collisions.** The smallest option is a one-per-session report from
   the merge path when it replaces or updates a live node of the same id from
   a frame that is not this tab's own. It pairs with the expected-failure spec
   above and must stay inside the follower boundary (no sweep).
4. **Decide the replace-mode behavior.** Either report how many local-only
   nodes and links a replace removed, or exempt local adds made after the
   draft was posted. The rationale for the current behavior is that the draft
   already carries the human's effect, which does not cover edits made between
   the draft and the new lineage's first frame.
5. **Suspected, unverified.** Each needs a repro before any claim is asserted.
   - A `doc_reset` that reaches a bound but inactive follower appears to arm
     neither the replace nor the sender abort, so a parked batch minted for the
     old lineage could resume against the new one.
   - The replace flag is consumed only by an applied non-echo frame, so a
     post-reset catch-up that never produces one could leave the next live
     frame to run the replace.
   - A rejection result that arrives while the bound tab is inactive appears
     to revert against whatever graph is current instead of the bound
     workflow's.
6. **Blueprint definitions.** Mint `define_subgraph` from the human insert
   path, scheduled with the node's add. This is frontend-only.
7. **Backend dependencies, still open.** Per-op outcomes so that a dropped
   last-writer or delete-wins op stops counting as applied, op ids on
   `doc_update` so that echoes could be matched instead of filtered by actor,
   a lineage token, and an echoed subscribe identity so that an
   acknowledgement can be tied to a subscribe.

## Alternatives considered

- **Re-enqueue held ops when the same workflow rebinds.** Rejected here. A
  re-sent add is not idempotent against a changed document, and nothing
  distinguishes a tab-switch loss from a retry-budget one. Retention and
  replay with the original op id is CRDT-REPLAY-0039's territory.
- **Re-mint the local node's id on collision (ADR-ECS-IDENTITY-0016).** Not
  needed: disjoint id minting removes the collision for ids minted while
  bound.
- **Filter echoes by op id.** Blocked: op ids are not on `doc_update`.
  Dropping on the actor string is what main does.
- **Drop frames from this tab's actor wholesale.** Adopted, with a known risk
  carried over from CRDT-FOLLOWER-0025: if the relay folds an agent op into a
  frame written by the human actor, the agent's effect is dropped with it.
- **Keep a second per-op registry beside the graph intents.** Rejected. It
  would be a second source of op identity that has to stay in step with the
  sender. The follow-up above keeps any state inside the sender, keyed by the
  op id the intent already carries.
- **Host-side definition registration on first sight of an unknown type.**
  Rejected. It moves frontend definition data into the host through a side
  channel and bypasses the op log, in favor of the `define_subgraph` op the
  package already carries.

## Superseded design

The earlier version of this record proposed a per-lineage pending-op ledger,
protected-state predicates that a reconcile consulted, a bounded `unresolved`
outcome for ops that timed out, and a ledger-aware sweep and echo gate. That
design was overtaken when #18700 deleted the reconcile layer, so none of it
exists on main. Readers of older review threads can map the four requirements
above onto what those threads called the ledger's guarantees.

## Rollout status

Architectural dependency order lives in Remaining gaps and follow-ups above.
This section deliberately does not carry PR numbers, branch names, head SHAs,
package versions, or other in-flight status, since they drift independently of
the decisions recorded here.

## Consequences

### Positive

- The protection of pending local state no longer depends on a registry that
  must be kept in step with the sender. A frame cannot remove or recreate what
  it does not name.
- A rejection reverts exactly the refused registers, for every op kind, from
  the document, so a refusal cannot widen into a reconcile.
- A failed delete no longer resurrects the node on a later frame; the failure
  mode is divergence, which the first follow-up makes visible.
- The four requirements are written down as a contract, so a future change to
  the apply path is judged against them.

### Negative

- Three outcomes (`unacknowledged`, `unconfirmed`, `undeliverable`) are
  invisible to the user, and a late rejection after one of them is swallowed.
  The local graph can stay different from the document with no signal.
- A `doc_reset` replace removes local-only nodes and links silently.
- A widget value stops being held when its op settles, so after a timeout the
  next remote value overwrites what the user typed.
- Same-id collisions with another writer are resolved silently in the
  document's favor. Ids from before binding remain exposed.
- An op the host drops as last-writer-loses or delete-wins is counted as
  applied until the host reports per-op outcomes.
- The human path still mints no `define_subgraph`, and subgraph interior edits
  are not representable.
- Dropping the own actor wholesale loses an agent effect folded into such a
  frame (accepted in CRDT-FOLLOWER-0025).
- Bounded time holds only while the tab is active.

## Notes

- This record does not add a sweep or a reconciliation pass; the follower
  boundary check rejects both, and any gap fix above must stay within it.
- ADR-CRDT-LAYOUT-0003: layout deletions still go through the layout store's
  command boundary.
- See Relationship to existing ADRs above for how this record composes with
  CRDT-FOLLOWER-0025, CRDT-WRITE-0035, CRDT-REPLAY-0039, CRDT-AUTHORITY-0035,
  CRDT-FOLLOWER-0035 and GRAPH-DOCUMENT-0024.
