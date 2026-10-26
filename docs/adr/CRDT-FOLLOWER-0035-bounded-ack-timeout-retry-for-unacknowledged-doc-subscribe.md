# ADR-CRDT-FOLLOWER-0035: Bounded Ack-Timeout Retry for Unacknowledged CRDT Doc Subscribe

Date: 2026-09-19

## Status

Proposed

## Context

The in-app agent's CRDT follower (`src/workbench/extensions/agent/crdt/`)
subscribes to a workflow document by sending a `doc_subscribe` frame and
waiting for the host's `doc_subscribed` acknowledgement, which is followed by a
state-vector catch-up `doc_update`. The follower models subscription as intent
(`desiredWorkflowId`) reconciled against transport reality (`sentWorkflowId`)
in `layoutFollowerBridge.ts`: `reconcile()` sends the frame and records
reality; from then on it is a no-op until something clears reality again.

Reality is cleared by exactly two things: a failed send (the socket was not
open, so the next `status` frame retries) and an explicit `doc_subscribed
{ ok: false }` refusal, which `agentCrdtDocLifecycle.ts` retries with a
bounded exponential backoff (500 ms × 2ⁿ, six attempts). A 30-second recency
probe also resubscribes a channel that has gone quiet, but it is armed only
once a subscribe has been confirmed, and the reconnect path disarms it.

Nothing handles a third outcome: the subscribe frame leaves the transport and
is never answered at all. The bridge then believes it is subscribed, every
`status`-frame reconcile no-ops, the recency probe never arms, and the
follower stays at `connected: false` indefinitely. A field report showed
exactly this shape after a socket reconnect: the agent's `add_node` op was
present in the document's event log, absent from the follower's own doc, and
the agent (whose chat rides the same, recovered socket) reported success. The
regression spec in
[#18073](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18073) reproduces
it by accepting the post-reconnect `doc_subscribe` and never answering.

Whether production actually drops post-reconnect subscribe frames server-side
is unconfirmed and is being investigated separately. Independently of that
answer, a client that can hang forever waiting on a silent peer is a defect.
The bridge already contains a send that fails or throws, so a broken transport
cannot abort a Vue watcher or an unmount hook and the next `status` frame
retries; a send that succeeds and is then never answered had no equivalent
guard.

Constraints from existing decisions:

- [ADR-GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md):
  ordinary recovery is same-lineage state-vector replay against the existing
  follower doc; only an explicit host `doc_reset` may replace it. A retry must
  therefore resubscribe with the current state vector, never remint the doc.
- [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md):
  the follower never writes the shared doc; a retry may emit only subscription
  frames. Teardown must remain total and failure-tolerant.
- The existing timers (refusal backoff, recency probe) live in
  `AgentCrdtDocLifecycle`, are cancelled by retarget, reconnect and teardown,
  and must not be made to fight a new timer.
- The ingest relay's own resync budget is 15 seconds. A client timeout shorter
  than that would stack a duplicate subscribe behind a slow but live catch-up.

## Decision

Treat a subscribe that was sent and not acknowledged within a bounded window
as a failed attempt, and retry it the same way the follower already retries a
refused subscribe: same lineage, same state vector, bounded attempts, then a
reported terminal state.

- **Arming signal at the send boundary.** `LayoutFollowerBridge.reconcile()`
  dispatches a `doc_subscribe_sent` event exactly when a subscribe frame
  leaves the transport (not when the send fails; that case is already covered
  by the status-frame reconcile). Every path that resubscribes goes through
  `reconcile()`, so reconnects, gap-forced resyncs, resets and recency probes
  all arm the timer without further wiring.
- **Timer owned by the lifecycle.** `AgentCrdtDocLifecycle.onSubscribeSent()`
  arms a single ack timer of `SUBSCRIBE_ACK_TIMEOUT_MS = 15_000`, matching
  the relay's resync budget. A confirm or a refusal clears it (a refusal hands
  off to the existing backoff). Retarget, reconnect and destroy clear it. The
  bridge stays timer-free.
- **Bounded, shared budget.** On expiry the lifecycle consumes one attempt
  and calls `resubscribe()`, whose send re-arms the timer. Spacing is the
  timeout itself, so an all-silent run sends frames at 0 s, 15 s and 30 s and
  gives up on the third expiry at 45 s (`SUBSCRIBE_ACK_MAX_TIMEOUTS = 3`).
  Silent attempts also count into the existing six-attempt refusal counter, so
  any mix of silence and refusals stays bounded. A confirm resets both
  counters; so does a reconnect, since a new socket is a new server-side
  session; so does a retarget.
- **Terminal state.** On the third unanswered attempt the lifecycle stops,
  disarms the recency probe, latches a give-up flag, records a terminal
  `subscribe_ack_timeout` dev event, reports one
  `failure_confirming_agent_doc_subscribe` warning through the telemetry
  facade, and tells the composable, which sets `connected: false` (the state
  the debug panel and debug report already surface). While latched, neither
  the recency probe nor a `status`-frame reconcile may resubscribe. The latch
  is released by a confirm, a reconnect or a retarget; a `doc_reset` still
  sends its fresh-lineage subscribe, and its acknowledgement recovers the
  follower.
- **No new product flag.** The follower already runs behind
  `agentPanelStore.enabled`; this change adds only bounded idempotent
  subscription frames and telemetry.

### Alternatives considered

- **Rely on the existing 30 s recency probe only.** Rejected: the probe arms
  only after a confirmed subscribe and is explicitly disarmed on reconnect,
  which is the failing path. Arming it on send instead would make it a 30 s
  first retry with unbounded re-probing, and would blur "quiet but healthy"
  with "never answered".
- **Server-side fix only.** Rejected as the sole fix: it is the right durable
  answer if the relay is confirmed to drop frames, but it leaves the client
  able to hang on any future silent failure (network middlebox, relay
  restart mid-handshake, a bug in another server). The client change is
  defence regardless of the server outcome, and its telemetry is how the
  server hypothesis gets measured in production.
- **Unbounded retry.** Rejected: a persistently silent server would turn
  every open panel into a fixed-rate frame source, and the follower would
  never surface that it is stuck. Bounded attempts with a reported terminal
  state keep the failure visible.
- **Surface an error to the user without retrying.** Rejected: the common
  case is almost certainly a transient race that one retry fixes; making the
  user reload for that is worse than two silent retries. User-facing
  messaging for the terminal state can be added later on top of the same
  signal.
- **Treat silence exactly like `ok: false` and reuse the refusal backoff.**
  Rejected in its literal form: a refusal is a fast, explicit answer, so
  exponential spacing is what keeps a rejected subscribe from hammering the
  host; silence already costs a 15 s wait per attempt, so stacking 500 ms to
  16 s of backoff on top would stretch the budget well past a minute for no
  benefit. The two outcomes do share the attempt counter and the retry action.
- **A shorter timeout (5 s) with more attempts.** Rejected: the relay's resync
  budget is 15 s, so a 5 s client timeout would send a duplicate subscribe
  while a slow but live catch-up was still being computed, and the duplicates
  would stack.
- **Timer inside the bridge.** Rejected: the bridge is a synchronous
  intent/reality machine with a synchronous test suite; putting time policy
  in it couples transport reality to scheduling and would require a third
  "sent, awaiting ack" state that nothing else reads.

## Consequences

### Positive

- A silently dropped subscribe now recovers within 15 s instead of never, and
  the regression spec can be flipped from an expected failure to a passing
  test.
- Every resubscribe path (reconnect, gap, reset, recency probe) gains the
  same guard without per-path wiring, because the arming signal sits at the
  single send boundary.
- The failure becomes measurable: the terminal warning count in production is
  direct evidence for or against the server-side hypothesis.
- No new lineage or reset authority moves to the client; retries are
  same-lineage state-vector subscribes, so the constraints of
  ADR-GRAPH-DOCUMENT-0024 and ADR-CRDT-FOLLOWER-0025 are untouched.

### Negative

- A slow but live host that acks after more than 15 s will see a duplicate
  subscribe on the same connection. A repeat `doc_subscribe` on one
  connection is the relay's documented idempotent re-join path (re-join the
  fanout, ack, catch up against the offered state vector), so the retry is
  safe, but it is not free: each one costs the host a state-vector diff.
- The follower's state machine gains one more timer, one more bridge event
  and one latch; the interaction table (confirm, refuse, silence, reconnect,
  retarget, destroy, give-up) must be kept covered in the lifecycle's unit
  tests.
- Human ops sent during the silent window still go to a subscription the
  server may not hold; that path is unchanged and relies on the op sender's
  own result-silence handling.
- The terminal state is visible only in the dev panel, the debug report and
  telemetry. A user whose follower exhausts the budget still sees a silent
  canvas until a reconnect, a retarget or a reset; user-facing messaging is
  deferred.

## Notes

- Source files: `src/workbench/extensions/agent/crdt/layoutFollowerBridge.ts`,
  `agentCrdtDocLifecycle.ts`, `useAgentCrdtFollower.ts`, `devPanelLog.ts`.
- Regression spec: `browser_tests/tests/agent/agentGraphOpLostOnDisconnect.spec.ts`
  ([#18073](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18073)); the
  fix rewrites its mock to drop only the first post-reconnect subscribe and
  answer the retry with the ack and the catch-up update.
- Out of scope and deliberately separate: the read-gate latch that keeps a
  follower closed after a `schema_error` until a host `doc_reset`. Releasing
  it client-side would be a client-decided lineage break, which
  ADR-GRAPH-DOCUMENT-0024 forbids; it needs its own decision.
