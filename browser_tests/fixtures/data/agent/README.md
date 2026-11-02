# Agent conversation capture

Conversation replays must use recorded cloud-agent responses. A fixture holds
one thread, and each of its turns lands on the graph the previous turn left. The
recorder combines two records per turn:

1. Websocket `agent_*` frames, in received order.
2. The cloud backend's durable parent `agent_tool_calls.result` plus the
   accepted operation IDs from its child audit rows.

Do not write `graph_ops` by hand or relabel a synthesized response. The fixture
schema rejects `response_side: recorded` without a cloud thread ID and an
export timestamp under `source.capture`, and without a `message_id` on every
turn. Recorded events are the production socket
union (`zAgentWsEvent` in `agentApiSchema.ts`) minus the thread and message ids
the replay mints, so when production changes shape the fix is a new recording
or a production-side change, never a looser fixture schema.

## Adding a replay case for a fix

When a fix changes how the agent's turns affect the app (graph edits, CRDT
frames, panel state), add a replay case with the fix:

1. **Record the conversation** that reproduces the bug's turn, as described
   below.
2. **Add the replay case.** Assert the canvas-observable outcome the bug
   corrupted (graph end state or panel state), not mock call counts or model
   text. Write what a user sees for each turn (complete assistant text, tool
   rows in order) into `agentConversationExpectations.ts`; the replay asserts
   those literals and never predicts production rendering.
3. **Prove it bites.** Run the case against the fix's parent commit (red) and
   at the fix (green), and paste both run lines in the PR description. A case
   that never went red against the bug is not regression coverage.

Name the case after the behavior it protects (`agent-<behavior-slug>.json`)
and cite the fix PR in the fixture's `source.note`. The recorder writes the
provenance the replay keeps: `source.capture` (backend, thread id, export
time), `turns[].message_id`, and `source.note` (row ids and the raw capture
hash). A bad fixture is re-recorded, never edited.

## Replaying

Replay needs only a ComfyUI backend on 8188. Start the cloud-distribution
frontend:

```bash
DISTRIBUTION=cloud DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8188 pnpm dev
```

Then replay every recorded fixture from a second terminal:

```bash
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud \
  pnpm exec playwright test browser_tests/tests/agent/agentConversationReplay.spec.ts \
  --project=cloud
```

Add `-g '<case-id>'` for one case and `--headed` to watch it.
`AGENT_REPLAY_TIMING=recorded` waits out the recorded gaps between frames. Set
`TEST_COMFYUI_DIR` to the ComfyUI install behind 8188 so the suite backs up and
restores its user data.

The dev server cannot run the agent cases that assert the panel stays hidden
while the product flag is off: `setupFlagGate()` in
`src/extensions/core/agentPanel.ts` force-enables the panel in development
mode. CI serves a production build. To run those cases locally, serve one:

```bash
DISTRIBUTION=cloud pnpm build:cloud
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:8188 DISTRIBUTION=cloud \
  pnpm exec playwright test browser_tests/tests/agent/ --project=cloud
```

with ComfyUI started as `--front-end-root <repo>/dist`.

## Recording a case

Prerequisites: the cloud checkout beside this repo with its own local stack up
(`cloud up` there: Postgres on 54331, Redis on 6379), a ComfyUI backend on
8188, `ANTHROPIC_API_KEY`, and `COMFY_BIN` pointing at a comfy-cli that works
without a home directory.

1. Bring the recording stack up: the cloud agent in non-standalone mode with
   the doc host beside it. The Temporal engine lets a turn be cancelled.

   ```bash
   AGENT_MODEL=claude-opus-5 COMFY_BIN=~/.local/bin/comfy pnpm exec tsx scripts/dev-agent-integration.ts --record --engine temporal --catalog browser_tests/fixtures/data/agent/conversations/agent-rec-set-widget-existing.json --cloud-repo ../cloud --agent-port 8087 --doc-host-port 8096 --temporal-port 7234
   ```

2. Run the recorder command it prints, with every stack value filled. Fill
   `AGENT_MODEL`, the case id, the seed fixture, and one `--prompt` per turn
   (`--cancel-turn` and `--cancel-after-ms` for a cancelled turn).

3. Replay the new case as above with `-g agent-rec-<slug>`.

### The recorder command

One command records a whole thread against a running agent, applies the gates
below, and writes the fixture. Repeat `--prompt` once per
turn; they run in order on one thread:

```bash
AGENT_CLOUD_SHA=$(git -C ../cloud rev-parse HEAD) AGENT_MODEL=claude-opus-5 \
AGENT_M2M_SECRET_FILE=/path/to/m2m.secret \
AGENT_WORKSPACE_ID=... AGENT_USER_ID=... \
AGENT_REDIS_EXEC="<redis-cli command>" AGENT_PG_EXEC="<psql command>" \
pnpm exec tsx scripts/agentConversationRecord.ts \
  agent-rec-<slug> \
  browser_tests/fixtures/data/agent/conversations/agent-l4-zimage-string-node-prompt.json \
  --prompt "Switch to the tab 'Text to image', then <what turn 1 should do>." \
  --prompt "<what turn 2 should do>" \
  --out browser_tests/fixtures/data/agent/conversations/agent-rec-<slug>.json
```

The second positional argument is an existing conversation fixture, used only
for its `workflow` block: the recorder seeds a throwaway turn with that graph
and catalog, then records the prompted turns against it. The first prompt must
switch tabs, because the replay subscribes to the document only on an
`agent_active_tab` frame and switching to an already-focused tab publishes
nothing; later turns inherit that subscription, so only the first one needs it.
Turn 1 opens the thread, and every later turn posts to it the way the panel
does.

Recording runs against the cloud agent in its non-standalone mode, with
Postgres, Redis and the doc host beside it: frames come from its Redis channel
and rows from Postgres. That is the only path. The same agent
in standalone mode (SQLite, no doc host) never writes the audit rows that carry
the graph operations a replay asserts, so it can only produce text-only or
tool-error turns.

The recording agent shells out to `comfy-cli` for its read and edit tools inside
a sandbox that overrides `HOME`, so point `COMFY_BIN` at an installation that
works without a home directory. A turn recorded without it produces an answer
reporting tool failures rather than a usable fixture.

Environment. Five values are required: the two provenance values and the three the recorder needs to reach the stack (the CLI refuses to start without them); the rest are optional.

| Variable                              | Purpose                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `AGENT_CLOUD_SHA`, `AGENT_MODEL`      | recorded into the fixture note; both required                          |
| `AGENT_FULLSTACK_URL`                 | agent base URL, default `http://127.0.0.1:8086`                        |
| `AGENT_M2M_SECRET_FILE`               | path to the shared secret, read at runtime and never printed; required |
| `AGENT_WORKSPACE_ID`, `AGENT_USER_ID` | identity headers, as seeded by the launcher; required                  |
| `AGENT_REDIS_EXEC`, `AGENT_PG_EXEC`   | commands that reach the stack's Redis and Postgres, split on spaces;   |
|                                       | default `redis-cli` and `psql -U postgres -d postgres -At -c` (the     |
|                                       | launcher prints `docker exec` forms when the CLIs are not on PATH)     |
| `AGENT_ATTEMPT`                       | attempt label in every artifact name; defaults to a UTC stamp          |
| `AGENT_TURN_TIMEOUT`                  | milliseconds to wait for the turn, default 180000                      |

Alongside the fixture the command writes a `recordings/` directory holding the
raw frames, one retrieved row set per turn (the parent rows and their applied
ops live there), and a receipt: per turn the message id, kept-frame count,
parent and mutating-parent counts, child status counts, and the row file path
with its hash; overall the thread and workflow ids, dropped-frame counts, draft
counts, and the raw and seed artifact paths with hashes. Those are provenance
for the recording, not committed fixtures. Use `--work <dir>` to put them
elsewhere.

A refused recording names the gate it failed and appends the reason to
`recordings/<case-id>.refused.jsonl`. Re-record with a new `AGENT_ATTEMPT`
rather than editing a capture by hand.

## Import a Langfuse session

A conversation that already ran on a hosted agent becomes the same fixture
from its Langfuse trace, without re-recording:

```bash
AGENT_CLOUD_SHA=<cloud sha> pnpm exec tsx scripts/agentConversationFromLangfuse.ts <caseId> <seedFixture.json> --trace <traceId> --workflow <cloudWorkflowId> --out browser_tests/fixtures/data/agent/conversations/<caseId>.json
```

`--session <sessionId>` takes every trace of a session. Credentials come from
`~/.config/comfy-agent/langfuse.env` (`LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY`; `--env-file` points elsewhere) and never reach an
artifact.

The importer reads what the agent's instrumentation emits (cloud
`harness/telemetry/attrs.go`, `loop/host.go`): the turn span, marked
`gen_ai.operation.name: invoke_agent`, carries `comfy.thread_id` and
`comfy.turn_id` (the launch span above it carries the ids but no text); a tool
span carries `gen_ai.tool.call.id`, `gen_ai.tool.name` and `comfy.tool.ok` and
reaches its turn through `parentObservationId`; the turn's input and output
exist only with content capture on. A turn without recorded output is refused;
`--prompt` supplies turn inputs positionally from turn 1 and replaces the
captured input at those positions. It rebuilds
the tool-call and message frames, reads the audit rows with the recorder's own
query (`AGENT_PG_EXEC` must reach that environment's Postgres), and runs the
same assembly gates as a recording. So it imports a session whose audit
database is still reachable, not any Langfuse session.

It reads Langfuse's v2 observations endpoint (`/api/public/v2/observations`,
filtered by `traceId` or `sessionId`, paged by `meta.cursor`); the v1 traces and
observations reads are removed on 2026-11-16. v2 returns input and output as raw
strings, which the importer parses back to JSON when they are JSON, and
flattens attributes to `attributes.<key>` metadata keys, which `attributeOf`
reads alongside the v1 `metadata.attributes` shape. Checked 2026-10-27 against
a production trace: the v1 and v2 reads give the same capture.

UNVERIFIED until the first real import with audit rows: that `comfy.turn_id` is
the message id the audit rows carry.

An import keeps `response_side: recorded`: the replies and accepted ops are the
agent's, only the socket framing was rebuilt, and the replay suite lists
recorded fixtures only. Thinking frames are absent; the trace does not carry
them. The trace carries no active-tab frame either, so the importer rebuilds
one for the opening turn (the `--workflow` id and the seed's name) for assembly
to bind the workflow through.

## Capture

The recorder keeps the agent-socket frames of the thread (what the panel reads
on `/api/agent/events`; the replay serves them there through
`AgentFollowerHostSocket`) with their receipt times and,
after the last turn completes, reads each turn's audit rows itself: the parent
tool-call rows with their child op ids and statuses, plus the draft as it stands
at the end of the thread (`readRows` in `scripts/agentConversationRecord.ts`
holds the query). Each turn's rows land in `recordings/` as
`<case-id>.<attempt>.rows.<n>.json`; a frame belongs to the turn whose message ID
it carries.

## Assembly

The recorder assembles the conversation itself: there is no intermediate
capture document and no separate export step.

It emits one conversation turn per recorded turn. It strips turn
identity from frames (the replay mints its own), inserts each durably accepted
op before its terminal tool-call frame, counts a frame from another turn as
dropped (the receipt's `frames_dropped`), and fails if an accepted op is
missing from the recorded parent result or a mutating call has no terminal
frame. Then run the conversation replay test for
the case.
