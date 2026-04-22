# Linear Slack Bot (@Linear) Reference

The skill drives Linear exclusively through the Linear Slack app (`@Linear`). **There is no Linear MCP, no `LINEAR_API_KEY`, no GraphQL.** Every Linear read/write happens as a Slack message that mentions `@Linear` in the `#bug-dump` thread, and the Linear Slack app performs the action and posts a reply card containing the issue URL.

## Why Slack-only

- The `#bug-dump` thread is already the source of truth; keeping the entire lifecycle (report → ticket → PR → resolution) in one thread means Processed Detection can grep the thread instead of a separate registry.
- No API key rotation, no MCP server install, no OAuth browser flow — works on any machine that already has the Slack MCP configured.
- The Linear Slack app's reply card (with issue URL, title, status, and assignee) IS the canonical receipt; the skill records its `ts` in the session log.

## Prerequisites (one-time, per workspace)

The Comfy Slack workspace must already have the Linear Slack app installed (it is — that's how humans use `@Linear` reactions today) and `#bug-dump` (channel `C0A4XMHANP3`) must have Linear enabled for the `Frontend Engineering` team. Nothing else to configure. If a `@Linear` invocation silently does nothing, the bot isn't present in the channel — surface that to the human rather than re-trying.

## Supported operations

Every operation is a `mcp__plugin_slack_slack__slack_send_message` call with `channel_id=C0A4XMHANP3` and `thread_ts=<parent-ts>`. The `text` is a natural-language instruction to the Linear bot. Keep the text concise — Linear parses the first line as the command intent.

### 1. Create an issue from the thread

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear create\nTeam: Frontend Engineering\nTitle: <title>\nStatus: Triage\nLabels: source:bug-dump, area:<area>, env:<env>, sev:<severity>, reporter:<handle>\n\n<description body>\n\nSource: <slack-permalink>"
})
```

Rules:

- Start with `@Linear create` on its own line — this is the command token the bot keys on.
- Always specify `Team: Frontend Engineering`. Without it, the bot falls back to the Slack workspace's default team, which may not be FE.
- `Status: Triage` pins the initial workflow state.
- `Labels:` — comma-separated. If a label doesn't exist yet in Linear, the bot creates it on first use (verified in Linear workspace settings). Keep the taxonomy exactly as SKILL.md § Label Taxonomy.
- `<description body>` — markdown per `reference/schema.md` Description Template. Use real newlines, not literal `\n`.
- End with `Source: <slack-permalink>` so the Linear issue body links back even if the auto-attachment of the parent message fails.

The Linear bot replies in the same thread with a card that contains:

- The Linear URL (`https://linear.app/comfy-org/issue/FE-NNNN`)
- Status, assignee (initially unassigned), and applied labels
- A "View in Linear" button

Parse the URL out of the bot's reply text (or attachments). If no card reply appears within ~10s of polling `slack_read_thread`, treat it as a creation failure — do NOT proceed to the `:white_check_mark:` confirmation reply.

### 2. Search existing open issues (dedupe)

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear search <keyword-1> <keyword-2>\nTeam: Frontend Engineering\nStatus: open"
})
```

The bot replies with a card listing up to ~5 matching open issues. Parse identifier (`FE-NNNN`) and URL per row. Treat a hit as a duplicate per SKILL.md § Pre-flight Dedupe Gate § Check 1.

If `@Linear search` is not supported in the installed Slack app version, fall back to Slack-native search across the `#bug-dump` thread replies (previous `@Linear` cards contain title + URL — grep those for the same keywords). Record which path was used in the session log so the human can see dedupe coverage.

### 3. Link an existing issue (dedupe: `L` response)

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear link FE-4521"
})
```

The bot replies with the linked issue card. The skill then posts its own `:white_check_mark: Linked to Linear: <URL>` confirmation reply (see SKILL.md § Slack Thread Reply).

### 4. Add labels to an existing issue

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear FE-4521 add-labels pr-open"
})
```

Used when an open PR is discovered after ticket creation and the Linear issue should flip to `pr-open`.

### 5. Change status

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear FE-4521 status In Progress"
})
```

Rarely used by the skill directly — usually status changes come from the `red-green-fix` PR lifecycle (Linear auto-moves to `In Review` when a PR references `Fixes FE-4521`).

## Description body template

The text that follows the command headers is rendered verbatim as the Linear issue description (markdown). Use this template — see `reference/schema.md` for field-by-field extraction notes:

```markdown
**Reporter:** <slack-display-name>
**Env:** cloud prod / local / electron / ...
**Severity (proposed):** high/medium/low
**Area:** ui / node-system / workflow / cloud / templates

## Repro

1. ...
2. ...

## Expected

...

## Actual

...

## Attachments (in Slack thread)

- image.png (png, 315 KB)
- Screen Recording.mov (mov, 37 MB)

## Source

Slack: <permalink>
Thread summary: <1-3 bullets if thread adds context>
```

The Slack permalink is load-bearing — it's the canonical route to attachments, reporter, and any follow-up discussion. Do NOT embed Slack file IDs (`F0AT...`) directly; they're permissioned.

## Parsing the bot's reply

After each `slack_send_message` that mentions `@Linear`, poll `slack_read_thread` (with `channel_id=C0A4XMHANP3`, `thread_ts=<parent-ts>`) up to 3 times, ~3s apart. Scan replies authored by the Linear Slack app user for:

- Any `https://linear.app/<org>/issue/FE-\d+` URL → capture as the issue URL.
- The `FE-NNNN` identifier pattern → capture as the issue identifier.
- An error phrase (`couldn't`, `failed`, `not found`, `no team matched`) → treat as failure; surface the full bot text to the human.

Record the bot reply's `ts` alongside the captured URL and identifier in the session log.

## Failure modes & handling

| Symptom                                                    | Likely cause                                   | Handling                                                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| No bot reply within 10s                                    | Linear app not in channel, or bot outage       | Halt the batch, surface to human, do NOT fabricate a Linear URL. Remaining approved candidates stay queued for re-run.                       |
| Bot replies with "no team matched"                         | Team name typo or Linear workspace drift       | Re-send with the exact team name from the Linear workspace (default: `Frontend Engineering`). If it still fails, ask the human to verify.    |
| Bot replies with "couldn't parse labels"                   | One of the labels has syntax the bot rejects   | Drop the offending label, re-send; log the partial-label failure so the human can patch after.                                               |
| Bot creates the issue but reply lacks the URL              | Rare bot format change                         | Re-fetch the thread after ~5s; if URL still absent, open Linear search via `@Linear search <title>` and recover the identifier + URL.        |
| Multiple `@Linear` replies match (duplicate card)          | The skill retried without polling first        | Keep the earliest card's URL; log the extras. Never re-issue `@Linear create` for the same candidate without confirming the first card failed. |

Never retry `@Linear create` without first running `@Linear search` for the same title keywords — a duplicate card is worse than an initial failure because the human has to close one of them manually.

## Why no direct API path

- The Linear MCP (official or community) would require either OAuth setup or `LINEAR_API_KEY` in env — both are per-machine hurdles the skill should not depend on.
- Direct GraphQL against `api.linear.app` has the same key-management cost and bypasses the Slack thread as the audit trail.
- Routing every action through `@Linear` in the thread gives humans full visibility in the channel (the bot's card is the receipt) and Processed Detection becomes a simple Slack thread read.

If a future need requires capabilities the `@Linear` Slack app doesn't expose (bulk operations, private field edits, webhooks), stop and surface the limitation to the human rather than quietly adding an API-key path — the "Slack-only" constraint is intentional.
