# ADR-CRDT-FOLLOWER-0052: The Workflow Document Owns the Follower Session

Date: 2026-11-04

## Status

Proposed

Drafted against [FRONT-3582](https://linear.app/comfyorg/issue/FRONT-3582).
It is a draft: it records the ownership decision and the migration order, and
it is not in force until frontend maintainers ratify it. Ratification is owed
by the owners of the follower seam — `DrJKL`, who owns the FE-2504 rewrite
this builds on, with `dante01yoon` for the panel and session surface — and the
product direction in Decision 4 was already approved by Christian Byrne (see
Notes).

## Context

The follower is the inbound half of the in-app agent: the host applies ops to
a shared Yjs document and broadcasts the result, and the frontend replays that
document onto the live `LGraph`
([CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)).
This record is about **who owns that replica's lifetime**, not about how a
frame is applied.

### What owns it today

Read from `main` at `13368a2439`:

- `DockedAgentPanel.vue:37` renders `AgentPanelRoot` under `v-if="docked"`,
  where `docked` is `agentPanelStore.isVisible`
  (`agentPanelStore.ts:251`, `enabled && isOpen`). `isOpen` is flipped by the
  topbar button through `toggle()` (`agentPanelStore.ts:331`). Closing the
  panel is therefore an ordinary one-click action that **unmounts** the panel
  root.
- `AgentPanelRoot.vue:1210` is the only production call site of
  `useAgentCrdtFollower`. The follower runs in an `effectScope` created inside
  that component (`useAgentCrdtFollower.ts:347`).
- `startAgentCrdtFollower` constructs the whole seam in that scope:
  `DocFrameClient`, `LayoutFollowerBridge` — which owns the semantic replica,
  `private followerDoc = new FollowerDoc()` (`layoutFollowerBridge.ts:69`) —
  `AgentCrdtDocLifecycle`, `AgentCrdtProjection` and the op sender
  (`useAgentCrdtFollower.ts:434-458`).
- `onScopeDispose` tears all of it down, including `projection.destroy()`,
  `bridge.destroy()` — which calls `followerDoc.destroy()`
  (`layoutFollowerBridge.ts:314`) — and `sender.detach()`
  (`useAgentCrdtFollower.ts:1263-1291`). The same teardown reports every
  collected-but-unapplied document frame as `discarded`
  (`useAgentCrdtFollower.ts:1282-1285`).
- `AgentPanelRoot.vue:1737-1796` detaches `docOpMinter` and stops the session
  in `onBeforeUnmount`; several of its drop reasons are literally
  `'panel_closed'`.
- The only thing that survives the unmount is a single `sessionStorage` slot,
  `Comfy.Agent.CrdtDocId` (`agentCrdtDocLifecycle.ts:32`): one document id, no
  document key, a page-session nonce and a five-minute TTL. Its own comment
  (`agentCrdtDocLifecycle.ts:10-31`) records that this is bounded rather than
  closed for a same-tab workflow switch.
- `CRDT-FOLLOWER-0025`'s glossary states the lifetime as implemented: _"Follower
  lifetime: resources between product enablement and disablement or unmount."_

So the replica's lifetime is the panel component's lifetime. Three disturbances
are already handled correctly and show what the intended contract is:

| Disturbance                    | Replica                                                                                                                       | Pending human ops                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Editor tab goes inactive       | kept; resubscribe is a state-vector delta (`useAgentCrdtFollower.ts:1184-1201`)                                               | parked ([CRDT-WRITE-0035](CRDT-WRITE-0035-hold-pending-human-ops-across-tab-suspension.md))         |
| Socket drops / retries exhaust | kept; `reconnect()` resubscribes (`layoutFollowerBridge.ts:247`)                                                              | retained ([CRDT-REPLAY-0039](CRDT-REPLAY-0039-retain-exhausted-operations-for-same-page-replay.md)) |
| Sequence gap                   | kept; delta replay, never a wipe ([CRDT-RECOVERY-0029](CRDT-RECOVERY-0029-lineage-gated-replay-for-sequence-gap-recovery.md)) | unaffected                                                                                          |
| **Panel closed**               | **destroyed**                                                                                                                 | **drained as `detached`** (`opSender.ts:827-843`)                                                   |

Panel visibility is the one disturbance that still destroys the replica and
discards the write queue, and it does so only because the owner is a component
that panel visibility unmounts.

### What that costs, concretely

**A. An agent edit made while the panel is closed can be dropped from the
canvas, and the next message makes the drop authoritative.** Closing the panel
does not stop the turn: `useAgentSession.stop()` unsubscribes the local stream
and aborts client-side turn tracking (`useAgentSession.ts:1145-1168`); it calls
no server stop. The host keeps applying ops. On reopen the replica is new and
its state vector is empty, so the host answers with the whole current document
(`CRDT-RECOVERY-0029`: _"When the known value is absent or stale, the host
ignores the follower's state vector and returns the whole current document"_).
That frame arrives as an ordinary `doc_update` on an unchanged lineage, so no
`doc_reset` is synthesized (`layoutFollowerBridge.ts:488-507`), so
`AgentCrdtProjection` applies it in `merge` mode —
`replaceOnNextFrame` has exactly one caller, `onDocReset`
(`useAgentCrdtFollower.ts:980`), and `removeAbsent` runs only under
`mode === 'replace'` (`liveGraphApplier.ts:852`). An empty replica receiving a
whole document produces adds and no removes, and `merge` cannot express _"the
document no longer holds X"_. A node, link or widget the agent deleted while
the panel was closed therefore stays on the canvas. Then
[CRDT-AUTHORITY-0035](CRDT-AUTHORITY-0035-human-canvas-authority-and-draft-reconciliation.md)
clause 1 makes the posted canvas authoritative for the next human turn, so the
next message writes the stale node back into the document. The agent's edit is
reverted and nobody is told.

**B. Human edits around a panel close are lost in both directions.** With the
panel closed `docOpMinter` is detached, so a canvas edit mints nothing at all;
and the sender's `detach()` drains whatever was in flight or queued as
`detached` without delivering it. `CRDT-REPLAY-0039` already decided this is
wrong and names the fix: _"Closing or remounting the agent panel does not end
the page session and must not discard a retained operation… An implementation
may instead make the sender itself page-session-owned so panel teardown does
not detach it."_ Its Status records the gap: _"Panel teardown still drains held
batches, so the page-session lifetime below is not met yet."_ The production
evidence is on FRONT-3582: an `unconfirmed` and an `undeliverable` settlement
3 ms apart on frontend `1.59.5`, both `code=detached`, from one
`opSender.detach()` → `drainOutstanding()` teardown.

**C. A latent mis-bind the current wiring hides.** The persisted rebind path
(`restorePersistedTarget`, `useAgentCrdtFollower.ts:1203-1216`) would subscribe
to whichever document last confirmed a subscribe and project it onto whatever
root graph is on screen. It is unreachable from `AgentPanelRoot` today, because
`isFollowerActive` is false whenever `boundWorkflowId` is null
(`AgentPanelRoot.vue:1174-1195`), so the `(null, active)` state the branch needs
never occurs outside tests. A per-document owner must not resurrect it: a
session keyed by its own document never has to guess which document it holds.

The replica cannot provide the recovery the invariants promise unless it
outlives the disturbance. State-vector delta replay (`CRDT-RECOVERY-0029`
rules 1-3) is a property of a replica that survives; a replica that dies takes
its resume token with it and every recovery becomes a cold seed.

## Decision

1. **The workflow document owns the follower session, for as long as that
   document is open in this page session.** The owner is a registry keyed by
   workflow document id, not `AgentPanelRoot.vue`. A session is created when a
   document binds to a doc host. Panel visibility, panel mount, thread switch
   and editor-tab activity change what a session _does_; they never change
   whether it exists.

   **Disposal is by holder count, not by any single close.** Because Decision 3
   lets two editor tabs resolve to one document id, "the document closed" is
   not an event any one tab can report. The registry therefore hands out a
   lease: a holder acquires a session for a document id, and the session is
   disposed when the last lease is released — never when the first is. A panel
   is not a holder, since by Decision 2 it only consumes. Holders are the open
   editor tabs bound to that document id, so a session outlives any one tab and
   dies with the last one.

   This is the idiom the agent event source already uses rather than a new
   mechanism: `agentEventSource.ts:167-174` keeps the socket alive while any
   subscriber holds a listener and calls `disconnect()` only when
   `listeners.size === 0`. A lease that is acquired twice and released once must
   leave the session running, and a double release of one lease must not
   decrement twice.

2. **The Agent panel consumes a session; it does not construct one.**
   `useAgentCrdtFollower` resolves the session for the document the panel is
   bound to. Nothing under `src/workbench/extensions/agent/crdt/` reads panel
   state, tab bindings or the active tab: a session is given its document id,
   its graph accessor and its transport.

   **So the transport cannot stay panel-owned either.** Today
   `AgentPanelRoot.vue:263-269` constructs both the agent event source
   (`events`) and the doc-frame transport over it (`docTransport`), and
   destroys the transport in `onBeforeUnmount`. A registry that retained only
   the replica and the sender would leave a session whose transport the panel
   had just destroyed — unable to receive an update or to resubscribe, which is
   worse than today's honest cold seed. Both are therefore **page-session
   resources**, created and owned outside the panel for the lifetime of the
   page, and the panel receives them exactly as it receives a session.

   The event source needs no new lifetime machinery for this, only a surviving
   subscriber: its socket is already reference-counted by listener count, so it
   closes today because panel teardown drops the doc-frame tap
   (`agentDocFrameTransport.ts:49-52`) and the session stream at the same time,
   taking `listeners.size` to zero. A session that holds its own tap keeps the
   socket open by that existing rule.

3. **At most one replica per document id.** The registry returns the existing
   session for an id and never mints a second `FollowerDoc` for it. Two editor
   tabs that resolve to one workflow id — reachable, because an imported JSON
   file can be opened twice with one id
   ([AGENT-BINDING-0035](AGENT-BINDING-0035-document-identity-gates-persisted-workflow-tab-bindings.md))
   — share one replica and one lineage. This is the KEEP-ALIVE rule that
   bootstrap forks from one seeded snapshot and never independently re-seeds
   the same base; a per-document refactor is exactly where it would break.
   Sharing is what makes disposal a lease rather than a close, which is why
   Decision 1 counts holders.

4. **The minter and the sender share the session's lifetime.** Panel teardown
   no longer detaches `docOpMinter` or the op sender, which discharges
   `CRDT-REPLAY-0039`'s open clause by the second implementation it permits.
   Ops minted while the panel is closed are held and replayed after the next
   acknowledged resubscribe, with their original `op_id` — identity is still
   minted once and never regenerated.

5. **The replica is replaced only on a lineage break, and every projector is
   told first.** Unchanged from `CRDT-FOLLOWER-0025` and `CRDT-RECOVERY-0029`:
   an explicit `doc_reset`, a `lineage_seq` change adopted on
   `doc_subscribed`, or the reset synthesized after a re-minting or conflicting
   `doc_reseed_result`. Session disposal destroys its replica rather than
   replacing it. **Panel teardown stops being a replacement path**, so a panel
   close joins tab inactivity, a reconnect and a sequence gap as a
   state-vector resubscribe on the surviving replica.

6. **Layout is untouched.** `layoutStore` keeps one page-lifetime layout
   `Y.Doc`, reset per root graph
   ([CRDT-LAYOUT-0046](CRDT-LAYOUT-0046-layout-store-owns-its-ydoc-for-the-page-lifetime.md)
   clauses 1-2). A follower session does not acquire, hold, swap or dispose a
   layout document, and there is no per-document layout doc: 0046 rejected
   that, and merging the two lineages would wipe local layout for every graph.
   Remote geometry still reaches layout only as `LayoutOperation`s inside
   `layoutStore.withActor`
   ([CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)).
   One semantic replica per document, one layout document per page, composed
   and never merged.

7. **A cold seed is declared, never silently merged.** A frame answering a
   subscribe whose state vector was empty is a whole-document frame, not a
   delta, and the applier is told which kind it has. The canvas stays
   authoritative on a cold seed — `CRDT-AUTHORITY-0035` clause 1 makes the
   posted draft the reset request — so a session does not delete live entities
   to match the document. It marks the target `canvasMayBeStale` and reports
   the divergence, so the person is told rather than left to discover that an
   agent edit was reverted by their next message. Choosing `replace` on a cold
   seed instead would change 0035's authority rule and is out of scope here.

8. **Session count is not a licence to exchange state between sessions.** Two
   sessions for two documents never trade updates, state vectors or ops. Each
   follows its own host lineage one-way, and a follower still never writes the
   shared doc.

## Alternatives considered

- **Keep the panel as owner and transfer state across remounts.**
  `CRDT-REPLAY-0039` permits this for the sender: teardown hands every
  retained op to a page-session owner that the next instance resumes from.
  Rejected as the general answer, because it fixes one of the four things the
  panel owns. The replica, its lineage, its state vector and the minter would
  each need their own transfer, and a transfer is a second copy of the
  lifetime with its own failure mode — an incomplete handoff is
  indistinguishable from a cold start, which is the defect being removed.
  Moving the owner once removes the need for any handoff.

- **Make the follower a module singleton, like `layoutStore`.** Rejected: it
  gets the lifetime right and the identity wrong. One singleton can hold one
  document, so every workflow switch would re-mint it, which is the current
  behaviour with a longer-lived container. `layoutStore` can be a singleton
  because one layout document legitimately holds every root graph under scoped
  keys (0046 clause 1); a semantic replica is per document by construction,
  since its lineage and state vector belong to one host document.

- **Key the registry on the editor tab path instead of the document id.**
  Rejected: paths collide. Every anonymous draft shares one default path,
  which is the collision `AGENT-BINDING-0035` exists to gate, and two tabs can
  hold one document. Tab path is a presentation fact; lineage belongs to the
  document.

- **One session per open document, created eagerly for every tab.** Rejected
  for now: a document with no doc host has nothing to follow, and subscribing
  for every open tab multiplies catch-up traffic on page load for no
  user-visible gain. Creation stays on the bind-to-doc-host edge.

- **Fix only the sender (hold ops across panel close) and leave the replica
  panel-owned.** Rejected: it closes cost B and leaves cost A, and it leaves
  the worse shape in place — human edits held for a document whose replica no
  longer exists, so a replay has no state vector to replay against.

- **Treat the panel-close re-seed as a `doc_reset`.** Rejected: it is not a
  lineage break. Synthesizing one would make the client announce a reset the
  host never sent, discard legitimate pending state (`onDocReset` aborts the
  sender and clears pending frames), and move a `replace`-mode whole-document
  apply onto a path where `CRDT-AUTHORITY-0035` says the canvas wins.

- **Keep the `sessionStorage` doc-id slot as the continuity mechanism.**
  Rejected: it is one unkeyed slot with a five-minute TTL, it preserves an id
  rather than a replica, so continuity still costs a cold seed, and its own
  comment records the same-tab switch case as unclosed.

## Migration stages and enforcement

Each stage names the invariants it is at risk of breaking and the guard that
fails loudly if it does. The house rule is an ADR _and_ at least one
machine-enforced guard whose message names the broken invariant and links this
record, using the centralized `assert(cond, msg)` from `src/base/assert.ts`
(DEV throws, production reports). Stages 1-3 are landable on the current
shared root graph. **Stage 4 is not**, and must wait for
[#21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571).

**Stage 0 — pin the behaviour before moving it.** Two black-box cases, red on
current `main`, under `browser_tests/tests/agent/`: (a) with one widget edit in
flight and one queued, closing and reopening the panel still delivers both to
the document; (b) a node the agent deletes while the panel is closed is not
still on the canvas after reopening, or the person is told the canvas is
stale. Harness-first QA is mandatory here: unit coverage of the holders does
not substitute, and FRONT-3582's own acceptance note says not to close this
evidence on unit coverage alone. Guard: the specs themselves.

**Stage 1 — move the owner.** Two steps, in this order, because the second is
useless without the first.

_Stage 1a — the transport becomes page-session owned._ Move `events`,
`docTransport` **and the identity resolver that feeds the follower's user id**
out of `AgentPanelRoot.vue`'s setup into a page-session owner, and remove the
`onBeforeUnmount(() => docTransport.destroy())` and
`onBeforeUnmount(() => agentIdentity.stop())` calls that make panel teardown
drop the tap and the identity. That resolver (`resolveAgentIdentity`,
`AgentPanelRoot.vue:271-282`) and the `agentSocketIdentity` watcher that calls
`events.reconnect()` / `agentIdentity.reset()` on an account or workspace
change (`:284-314`) must move together: `agentUserId`
(`AgentPanelRoot.vue:1188-1190`), the value `useAgentCrdtFollower` is given as
`userId`, reads `agentIdentity.state.value` directly, so moving only the
transport would leave the follower's identity input, and its reconnect-on-
account-change behaviour, torn down by the same panel close Stage 1a exists to
stop affecting. The panel receives all three instead of constructing them.
Nothing else moves yet, so the follower seam still disposes with the panel and
the user-visible behaviour is unchanged except that the agent socket and
identity are no longer closed by a panel close.

_Stage 1b — the session registry._ Add the document-keyed registry with the
lease semantics of Decision 1; `AgentPanelRoot.vue` resolves instead of
constructing; panel mount and unmount stop creating and destroying the seam.

**"Change no behaviour" means no change to how a frame is applied** — the
applier, the projection and the recovery rules are untouched. It does not mean
no observable change: the whole point of the stage is that a panel close stops
destroying the replica and stops closing the socket, which is the Negative
consequence recorded below about a subscription the user cannot see. Keep
today's semantics for everything else, including "my graph is readable only
while my document's tab is active", which the shared root still requires. An
account or workspace change while the panel is closed must still reconnect
the socket and reset identity exactly as it does today while the panel is
open — Stage 1 acceptance covers that transition explicitly, not only the
panel-open case.
_Invariants at risk:_ the replica is replaced only on a lineage break, and a
reconnect recovers by state-vector delta rather than a wipe; one replica per
document id.
_Guards:_ an `assert` in the registry's create path naming the one-replica-per-
document rule and linking this ADR; a release-idempotency guard — each lease
handle tracks whether it has already released, and a second release of the
_same_ handle is a no-op that asserts loudly, since a holder-count floor of
zero cannot catch it: two distinct holders releasing the same handle twice
reads 2 → 1 → 0 and never goes negative, so a below-zero assert alone would
silently let a leased session dispose while another tab still holds it; and a
new rule in
`scripts/check-follower-invariants.ts` (run by `pnpm follower-invariants:check`
and by CI) restricting `new FollowerDoc(`, `new LayoutFollowerBridge(` and
`useAgentCrdtFollower(` to the session-owner module, which makes FRONT-3582's
first falsifiable check a CI check. That rule has to scan outside the existing
`FOLLOWER_SCOPE_PATTERNS`, since the call site it must forbid is
`AgentPanelRoot.vue`.

**Stage 2 — every operation producer joins the session.** Remove the op
producers and the sender from component teardown; hold and replay instead.
**Every** producer, not a subset: `AgentPanelRoot.vue:1737-1796` detaches
`docOpMinter` _and_ `restoreOpMinter` (`:1769`, `:1772`), so moving only the
first leaves a restore or undo edit made after a panel close unable to reach
the session's replay path — the same defect in a narrower window. If a producer
is deliberately left behind, the lifetime guarantee and the acceptance tests
must be narrowed to say so explicitly rather than reading as covering all
writes.
_Invariants at risk:_ `op_id` is minted once and never regenerated; conflicts
resolve on the stamp, not on client identity.
_Guards:_ a unit pin that the `op_id`s observed before a panel unmount are the
ones sent after remount; an `assert` that a replay carries an existing
`op_id`; and a rule that neither `opSender.detach()` nor any op-producer
`detach()` has a caller in a component teardown path. _Acceptance signal, not a test:_ the two `code=detached`
settlement signatures recorded on FRONT-3582 should stop appearing for
panel-close episodes.

**Stage 3 — declare the cold seed.** Carry the "state vector was empty at
subscribe" fact from the bridge to the projection, and surface divergence
through the existing `canvasMayBeStale` status instead of a silent merge.
_Invariants at risk:_ bootstrap forks from one seeded snapshot; no
intent is re-derived from end states — the divergence is _reported_, not
_repaired_, so this must not become a diff-and-patch pass.
_Guards:_ an `assert` that a whole-document frame is never applied in `merge`
mode without the cold-seed declaration; and unit pins that an empty-state-vector
catch-up marks the target stale whenever the live graph diverges from the
document. **The divergence test is over the whole semantic state, not the node
set.** Cost A above is a deleted node, link _or_ widget, and `merge` cannot
express a removal of any of the three, so a node-set comparison passes
unchanged while a deleted link or a reverted widget value survives on the
canvas — the guard would then certify exactly the case it exists to catch. Pin
a link-only deletion and a widget-only divergence alongside the node case.

**Stage 4 — collapse the identity holders. Gated on #21571.** One
`workflowId`, one lineage, one graph reference and one commit fence, replacing
the nine partial owners FRONT-3582 enumerates. This needs the per-workflow
`LGraph` instance from #21571 on `main`: a session cannot own a graph
reference while one shared root graph is reconfigured on every tab switch.
_Invariants at risk:_ no reconciliation pass is reintroduced under the name
"fence"; no intent re-derived from end states.
_Guards:_ FRONT-3582's second falsifiable check
(`rg -l "subscribedWorkflowId|TabBinding|activeWorkflowId"` over the `crdt/`
directory is empty) as a CI rule; and the twenty unit-only scenarios collected
on FRONT-3582 re-expressed as session-level cases, since the unit tests that
hold them today are deleted by this stage by construction.

This record does not authorize starting the refactor. It is the decision and
the order; the work is dispatched per stage.

## Consequences

### Positive

- One owner and one lifetime for the replica, the lineage, the minter and the
  sender, so there is nothing to hand off and no partial handoff to debug.
- A panel close becomes an ordinary resubscribe with a surviving state vector,
  which is what the recovery rules already promise for every other
  disturbance.
- `CRDT-REPLAY-0039`'s page-session lifetime is met rather than pending, and
  the production `code=detached` settlements have a named cause and fix.
- Human multiplayer can reuse the session type, because nothing in it knows an
  Agent panel exists.
- The cold-seed case stops being silent, so a reverted agent edit is reported
  instead of discovered.

### Negative

- Replicas outlive the panel, so a page session can hold several Yjs documents
  at once. With `gc: true` deleted items collapse to tombstone ranges, but the
  struct store still grows with edit history; if a long session measures this,
  the fix is a rebuild inside a session, not a shorter lifetime.
- A session that survives the panel keeps a subscription the user cannot see,
  so "the agent is syncing" state has to be discoverable from outside the
  panel. Today closing the panel hid the question.
- Stage 2 changes failure semantics the current telemetry encodes: a
  `detached` settlement stops meaning "the edit is gone", so dashboards and
  alerts keyed on it need updating with the change, not after it.
- Stage 4 deletes the unit tests that currently hold twenty scenarios. The
  scenarios have to be re-expressed at the session level in the same change or
  they are lost.
- Ownership moves out of a Vue component into a registry, which is one more
  module with a lifetime that no component's devtools shows.

## Notes

Christian Byrne approved the product direction behind Decision 4 on
2026-09-26 and clarified it on 2026-09-28; the approval is transcribed in
`CRDT-REPLAY-0039`'s Notes, and the program-side record is its ADR-012. This
record adds no new product decision: it answers _who owns the replica_, which
0039 left to an implementation choice.

Related records: `CRDT-FOLLOWER-0025` (what the follower does with a frame, and
the lifetime wording this record replaces), `CRDT-RECOVERY-0029` (replay, never
wipe), `CRDT-WRITE-0035` and `CRDT-REPLAY-0039` (holding and replaying human
ops), `CRDT-AUTHORITY-0035` (the canvas is authoritative for a human turn),
`CRDT-LAYOUT-0046` and `CRDT-LAYOUT-0003` (the layout document is separate and
page-lifetime), `AGENT-BINDING-0035` (document identity gates persisted
bindings),
[GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md)
and
[GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
(the document model this session hangs off).

FRONT-3582 asks for the session ownership to be recorded by amending a
`GRAPH-DOCUMENT` record instead. It is recorded here because the decision is
about the follower replica's lifetime and reads against the follower
invariants, and because the `GRAPH-DOCUMENT-0045` the ticket names does not
exist on `main` — it is part of #21571. A ratifier who prefers the amendment
should fold this text into that record when #21571 lands and supersede this
one.
