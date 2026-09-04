# Agent conversation capture

Conversation replays must use recorded cloud-agent responses. A fixture holds
one thread, and each of its turns lands on the graph the previous turn left. The
exporter combines two records per turn:

1. Websocket `agent_*` frames, in received order.
2. The cloud backend's durable parent `agent_tool_calls.result` plus the
   accepted operation IDs from its child audit rows.

Do not write `graph_ops` by hand or relabel a synthesized response. The fixture
schema rejects `response_side: recorded` without a cloud thread ID, a per-turn
message ID and an export timestamp.

## Playbook

```bash
cd ../cloud && cloud up
```

Then job 3 in `docs/testing/agent-integration-development.md` ("Start here"):
record mode, then the recorder command it prints with one `--prompt` per turn.
Replay the new case with job 1 there plus `-g <case id>`.

## Recording a conversation

One command records a whole thread against a running agent, applies the gates
below, and writes the fixture through the exporter. Repeat `--prompt` once per
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

The stack that command needs comes from the launcher's record mode (#16781):
with the cloud repo's own local stack running (`cloud up` in the cloud
checkout), run

```bash
pnpm exec tsx scripts/dev-agent-integration.ts --record --catalog browser_tests/fixtures/data/agent/conversations/<any fixture>.json
```

It asserts Postgres on 54331 and Redis on 6379, starts the doc host the cloud
repo ships, starts the agent non-standalone with `AGENT_CRDT_MODE=on` and
`AGENT_TARGET=local`, seeds the recorder's workspace and user, and prints the
recorder command above with every value filled, the secret by path.

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

Environment, all optional except the two provenance values:

| Variable                              | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `AGENT_CLOUD_SHA`, `AGENT_MODEL`      | recorded into the fixture note; both required                    |
| `AGENT_FULLSTACK_URL`                 | agent base URL, default `http://127.0.0.1:8086`                  |
| `AGENT_M2M_SECRET_FILE`               | path to the shared secret, read at runtime and never printed     |
| `AGENT_WORKSPACE_ID`, `AGENT_USER_ID` | identity headers, as seeded by the launcher                      |
| `AGENT_REDIS_EXEC`, `AGENT_PG_EXEC`   | commands that reach the stack's Redis and Postgres (the launcher |
|                                       | prints `docker exec` forms when the CLIs are not on PATH)        |
| `AGENT_ATTEMPT`                       | attempt label in every artifact name; defaults to a UTC stamp    |
| `AGENT_TURN_TIMEOUT`                  | milliseconds to wait for the turn, default 180000                |

Alongside the fixture the command writes a `recordings/` directory holding the
raw frames, one retrieved row set per turn, the intermediate
`agent-conversation.v2`
document and a receipt (turn IDs, parent rows, applied ops, dropped-frame
counts, artifact hashes). Those are provenance for the recording, not committed
fixtures. Use `--work <dir>` to put them elsewhere.

A refused recording names the gate it failed and appends the reason to
`recordings/<case-id>.refused.jsonl`. Re-record with a new `AGENT_ATTEMPT`
rather than editing a capture by hand.

Then run the replay, which picks up every recorded fixture in this directory:

```bash
PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud \
  pnpm exec playwright test browser_tests/tests/agent/agentConversationReplay.spec.ts \
  --project=cloud -g '<case-id>'
```

## Import a Langfuse session

A conversation that already ran on a hosted agent can be turned into the same
fixture from its Langfuse trace instead of re-recording it:

```bash
AGENT_CLOUD_SHA=<cloud sha> pnpm exec tsx scripts/agentConversationFromLangfuse.ts <caseId> <seedFixture.json> --trace <traceId> --workflow <cloudWorkflowId> --out browser_tests/fixtures/data/agent/conversations/<caseId>.json
```

`--session <sessionId>` takes every trace of a Langfuse session instead of one
trace. Credentials come from `~/.config/comfy-agent/langfuse.env`
(`LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`; `--env-file`
points elsewhere) and are never written to any artifact.

What the importer reads, from the agent's own instrumentation (cloud
`harness/telemetry/attrs.go`, `loop/host.go`): the turn span is the one marked
`gen_ai.operation.name: invoke_agent` and carries `comfy.thread_id` and
`comfy.turn_id` (the engine's launch span above it carries the ids but no
input or output); a tool span carries only
`gen_ai.tool.call.id`, `gen_ai.tool.name` and `comfy.tool.ok` and is attached
to its turn by walking `parentObservationId` (tool, model round, turn); the
turn's input and output exist only when the agent ran with content capture on
(pass `--prompt` per turn when it did not). From those it rebuilds the tool-call
and message frames, reads the turn's audit rows with the recorder's own query
(`AGENT_PG_EXEC` must reach that environment's Postgres), and runs the same
assembly gates as a recording. So the import works for a session whose audit
database is still reachable, not for any Langfuse session.

UNVERIFIED until the first run against a real trace, and stated here so nobody
reads them as fact: that `comfy.turn_id` is the message id the audit rows
carry; that the span attributes arrive under `metadata.attributes` (a flattened
`metadata` key is the coded fallback); that the observations page meta carries
`totalPages` (a short page ends the walk otherwise).

An imported fixture keeps `response_side: recorded`: the replies and the
accepted ops are the real agent's, only the socket framing was rebuilt, and the
replay suite lists recorded fixtures only. The provenance note names the
Langfuse origin, and thinking and active-tab frames are absent because the
trace does not carry them.

## Capture

Record the `/ws` frames for one eval turn and remove unrelated frame types. Keep
the original `thread_id`, `message_id`, `tool_call_id`, and ordering. Export the
matching backend rows with this query (bind `$1` to the thread ID and `$2` to
the assistant message ID):

```sql
SELECT
  parent.tool_call_id,
  parent.result,
  COALESCE(
    json_agg(child.op_id ORDER BY child.op_index)
      FILTER (WHERE child.status = 'ok' AND child.op_id IS NOT NULL),
    '[]'::json
  ) AS applied_op_ids
FROM agent_tool_calls AS parent
LEFT JOIN agent_tool_calls AS child ON child.parent_call_id = parent.id
WHERE parent.thread_id = $1
  AND parent.message_id = $2
  AND parent.parent_call_id IS NULL
GROUP BY parent.id
ORDER BY parent.started_at, parent.id;
```

Run the query once per turn, binding `$2` to that turn's message ID. A frame
belongs to the turn whose message ID it carries.

## Assembly

The recorder assembles the conversation itself: there is no intermediate
capture document and no separate export step.

It emits one conversation turn per recorded turn. It strips turn
identity from frames (the replay mints its own), inserts each durably accepted
op before its terminal tool-call frame, and fails if any frame belongs to
another turn, an accepted op is missing from the recorded parent result, or a
mutating call has no terminal frame. Then run the conversation replay test for
the case.
