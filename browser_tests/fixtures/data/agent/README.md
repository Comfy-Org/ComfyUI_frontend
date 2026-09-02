# Agent conversation capture

Conversation replays must use recorded cloud-agent responses. The exporter
combines two records from the same turn:

1. Websocket `agent_*` frames, in received order.
2. The cloud backend's durable parent `agent_tool_calls.result` plus the
   accepted operation IDs from its child audit rows.

Do not write `graph_ops` by hand or relabel a synthesized response. The fixture
schema rejects `response_side: recorded` without a cloud thread/message ID and
export timestamp.

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

Put those values in an `agent-backend-capture.v1` JSON document together with
the eval source, seed workflow, widget catalog, request, and captured frames.
The thread ID and message ID in `capture` must be the IDs used for both exports.

## Export

```bash
pnpm exec tsx scripts/agentConversationCapture.ts \
  /path/to/backend-capture.json \
  browser_tests/fixtures/data/agent/conversations/<case-id>.json
```

The exporter strips turn identity from frames (the replay mints its own),
inserts each durably accepted op before its terminal tool-call frame, and fails
if any frame belongs to another turn, an accepted op is missing from the
recorded parent result, or a mutating call has no terminal frame. Then run the
conversation replay test for the case.
