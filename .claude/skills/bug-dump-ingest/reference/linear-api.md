# Linear API Reference

Fallback path when no Linear MCP is registered. Requires `LINEAR_API_KEY` in env.

## Environment

```bash
export LINEAR_API_KEY="lin_api_..."
LINEAR_ENDPOINT="https://api.linear.app/graphql"
```

## Resolve team + state IDs once per session

Team and workflow state IDs are stable; fetch once and cache in `~/temp/bug-dump-ingest/linear-meta.json`.

```bash
curl -s -X POST "$LINEAR_ENDPOINT" \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ teams { nodes { id key name states { nodes { id name type } } } } }"}'
```

Pick the team whose `name` matches the target (default: `Frontend Engineering`). Record the `id` of the `Triage` state (preferred) or `Backlog` as the default creation state. Cache the team's `key` too (used to construct human-readable identifiers like `FE-1234` in logs).

## Search open issues (dedupe)

```bash
QUERY='query($q: String!) {
  issues(filter: { state: { type: { nin: ["completed", "canceled"] } }, title: { containsIgnoreCase: $q } }, first: 10) {
    nodes { id identifier title url state { name } }
  }
}'
curl -s -X POST "$LINEAR_ENDPOINT" \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "dropdown" --arg query "$QUERY" '{query: $query, variables: {q: $q}}')"
```

Use 2-3 of the highest-signal keywords from the proposed title. Join queries with OR by running multiple searches if the Linear filter doesn't support OR directly.

## Create an issue

```bash
MUTATION='mutation($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url title }
  }
}'
INPUT=$(jq -n \
  --arg teamId "$TEAM_ID" \
  --arg stateId "$TRIAGE_STATE_ID" \
  --arg title "$TITLE" \
  --arg description "$DESCRIPTION" \
  '{teamId: $teamId, stateId: $stateId, title: $title, description: $description, labelIds: []}')

curl -s -X POST "$LINEAR_ENDPOINT" \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg query "$MUTATION" --argjson input "$INPUT" '{query: $query, variables: {input: $input}}')"
```

The response `issue.url` is the Linear URL to paste into the Slack thread reply. The response `issue.identifier` (e.g. `FRONTEND-4710`) goes into the session log.

## Description Template

Linear supports Markdown. Use this template:

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

Keep the Slack permalink — it's the canonical link to attachments, reporter, and later discussion.

## Error handling

- HTTP 400 with `"errors": [...]`: inspect `errors[0].message`. Common causes: invalid `teamId`/`stateId` (cache is stale — re-fetch meta), title too long (>255), label IDs from a different team.
- HTTP 401: rotate `LINEAR_API_KEY`.
- HTTP 429: rate-limited; the skill should back off (sleep 10s) and retry once. If it fails again, fall through to the draft fallback for the remaining tickets.

Never retry a `issueCreate` mutation without first checking via `searchIssues` whether the issue was actually created — duplicate creations are worse than the original failure.
