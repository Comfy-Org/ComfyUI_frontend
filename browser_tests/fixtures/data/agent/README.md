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

## Recording a conversation

One command records a whole thread against a running agent, applies the gates
below, and writes the fixture through the exporter. Repeat `--prompt` once per
turn; they run in order on one thread:

```bash
AGENT_CLOUD_SHA=$(git -C ../cloud rev-parse HEAD) AGENT_MODEL=claude-opus-5 \
AGENT_M2M_SECRET_FILE=/path/to/m2m.secret \
REC_WORKSPACE_ID=... REC_USER_ID=... \
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
Postgres, Redis and the doc host beside it (the lean stack): frames come from
its Redis channel and rows from Postgres. That is the only path. The same agent
in standalone mode (SQLite, no doc host) never writes the audit rows that carry
the graph operations a replay asserts, so it can only produce text-only or
tool-error turns.

The recording agent shells out to `comfy-cli` for its read and edit tools inside
a sandbox that overrides `HOME`, so point `COMFY_BIN` at an installation that
works without a home directory. A turn recorded without it produces an answer
reporting tool failures rather than a usable fixture.

Environment, all optional except the two provenance values:

| Variable                              | Purpose                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `AGENT_CLOUD_SHA`, `AGENT_MODEL`      | recorded into the fixture note; both required                      |
| `AGENT_FULLSTACK_URL`                 | agent base URL, default `http://127.0.0.1:8086`                    |
| `AGENT_M2M_SECRET_FILE`               | path to the shared secret, read at runtime and never printed       |
| `AGENT_WORKSPACE_ID`, `AGENT_USER_ID` | identity headers; `REC_WORKSPACE_ID` / `REC_USER_ID` also accepted |
| `AGENT_REDIS_EXEC`, `AGENT_PG_EXEC`   | commands that reach the stack's Redis and Postgres                 |
| `AGENT_ATTEMPT`                       | attempt label in every artifact name; defaults to a UTC stamp      |
| `AGENT_TURN_TIMEOUT`                  | milliseconds to wait for the turn, default 180000                  |

Alongside the fixture the command writes a `recordings/` directory holding the
raw frames, one retrieved row set per turn, the intermediate
`agent-backend-capture.v2`
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

Put those values in an `agent-backend-capture.v2` JSON document: the eval
source, the seed workflow and widget catalog, a `capture` block naming the
backend, the thread ID and the export timestamp, and a `turns` array carrying,
per turn, its `message_id`, its `request`, its captured `frames` and its
`tool_calls`. Run the query once per turn, binding `$2` to that turn's message
ID. A frame belongs to the turn whose message ID it carries.

## Export

```bash
pnpm exec tsx scripts/agentConversationCapture.ts \
  /path/to/backend-capture.json \
  browser_tests/fixtures/data/agent/conversations/<case-id>.json
```

The recorder above calls this exporter for you; run it directly when you
already have a capture document.

The exporter emits one conversation turn per captured turn. It strips turn
identity from frames (the replay mints its own), inserts each durably accepted
op before its terminal tool-call frame, and fails if any frame belongs to
another turn, an accepted op is missing from the recorded parent result, or a
mutating call has no terminal frame. Then run the conversation replay test for
the case.
