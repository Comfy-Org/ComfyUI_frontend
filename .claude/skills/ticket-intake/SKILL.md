---
name: ticket-intake
description: 'Parse ticket URL (Notion or GitHub), extract all data, initialize pipeline run. Use when starting work on a new ticket or when asked to pick up a ticket.'
---

# Ticket Intake

Parses a ticket URL from supported sources (Notion or GitHub), extracts all relevant information, and creates a ticket in the pipeline API.

> **🚨 CRITICAL REQUIREMENT**: This skill MUST register the ticket in the Pipeline API and update the source (Notion/GitHub). If these steps are skipped, the entire pipeline breaks. See [Mandatory API Calls](#mandatory-api-calls-execute-all-three) below.

## Supported Sources

| Source | URL Pattern                                         | Provider File         |
| ------ | --------------------------------------------------- | --------------------- |
| Notion | `https://notion.so/...` `https://www.notion.so/...` | `providers/notion.md` |
| GitHub | `https://github.com/{owner}/{repo}/issues/{n}`      | `providers/github.md` |

## Quick Start

When given a ticket URL:

1. **Detect source type** from URL pattern
2. **Load provider-specific logic** from `providers/` directory
3. Fetch ticket content via appropriate API
4. Extract and normalize properties to common schema
5. **Register ticket in pipeline API** ← MANDATORY
6. **Update source** (Notion status / GitHub comment) ← MANDATORY
7. **Run verification script** to confirm API registration
8. Output summary and handoff to `research-orchestrator`

## Configuration

Uses the **production API** by default. No configuration needed for read operations.

**Defaults (no setup required):**

- API URL: `https://api-gateway-856475788601.us-central1.run.app`
- Read-only endpoints at `/public/*` require no authentication

**For write operations** (transitions, creating tickets), set:

```bash
export PIPELINE_API_KEY="..."  # Get from GCP Secret Manager or ask admin
```

**Optional (for local working artifacts):**

```bash
PIPELINE_DIR="${PIPELINE_DIR:-$HOME/repos/ticket-to-pr-pipeline}"
```

## Mandatory API Calls (Execute ALL Three)

**⚠️ These three API calls are the ENTIRE POINT of this skill. Without them, the ticket is invisible to the pipeline, downstream skills will fail, and Notion status won't update.**

**You MUST make these HTTP requests.** Use `curl` from bash — do not just read this as documentation.

### Call 1: Create Ticket

```bash
API_URL="${PIPELINE_API_URL:-https://api-gateway-856475788601.us-central1.run.app}"
API_KEY="${PIPELINE_API_KEY}"

curl -s -X POST "${API_URL}/v1/tickets" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: ${AGENT_ID:-amp-agent}" \
  -d '{
    "notion_page_id": "NOTION_PAGE_UUID_HERE",
    "title": "TICKET_TITLE_HERE",
    "source": "notion",
    "metadata": {
      "description": "DESCRIPTION_HERE",
      "priority": "High",
      "labels": [],
      "acceptanceCriteria": []
    }
  }'
```

Save the returned `id` — you need it for the next two calls.

### Call 2: Transition to RESEARCH

```bash
TICKET_ID="id-from-step-1"

curl -s -X POST "${API_URL}/v1/tickets/${TICKET_ID}/transition" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: ${AGENT_ID:-amp-agent}" \
  -d '{
    "to_state": "RESEARCH",
    "reason": "Intake complete, starting research"
  }'
```

### Call 3: Queue Source Update

```bash
curl -s -X POST "${API_URL}/v1/sync/queue" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: ${AGENT_ID:-amp-agent}" \
  -d '{
    "ticket_id": "TICKET_ID_HERE",
    "action": "update_status",
    "payload": { "status": "In Progress" },
    "priority": "normal"
  }'
```

> **Note:** The action MUST be `"update_status"` (not `"UPDATE_NOTION_STATUS"`). Valid actions: `update_status`, `update_pr_url`, `mark_done`.

### TypeScript Equivalent (if using pipeline client)

```typescript
import { PipelineClient } from '@pipeline/client'

const client = new PipelineClient({
  apiUrl:
    process.env.PIPELINE_API_URL ||
    'https://api-gateway-856475788601.us-central1.run.app',
  agentId: process.env.AGENT_ID!
})

const ticket = await client.createTicket({
  notion_page_id: pageId,
  title: ticketTitle,
  source: 'notion',
  metadata: { description, priority, labels, acceptanceCriteria }
})

await client.transitionState(
  ticket.id,
  'RESEARCH',
  'Intake complete, starting research'
)

await client.queueSync(ticket.id, 'update_status', { status: 'In Progress' })
```

## Workflow

### Step 1: Detect Source Type

Parse the URL to determine source:

```javascript
if (url.includes('notion.so')) {
  source = 'notion'
  // Load providers/notion.md
} else if (url.match(/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/)) {
  source = 'github'
  // Load providers/github.md
} else {
  // Error: Unsupported URL format
}
```

### Step 2: Load Provider and Fetch Data

Read the appropriate provider file for source-specific instructions:

- **Notion**: `providers/notion.md` - Uses Notion MCP, handles Slack links
- **GitHub**: `providers/github.md` - Uses `gh` CLI, handles Dosu comments

Follow the provider's instructions for:

- Fetching content
- Extracting properties
- **Updating the source** (Notion status → "In Progress", Assignee → pipeline owner)

### Step 3: Normalize to Common Schema

All providers must extract normalized ticket data following `schema.md`:

```json
{
  "id": "abc12345",
  "url": "https://...",
  "source": "notion | github",
  "title": "Ticket title",
  "description": "Full description",
  "status": "Not Started",
  "assignee": "username",
  "priority": "High",
  "area": "UI",
  "labels": ["bug", "frontend"],
  "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
  "fetchedAt": "2024-01-15T10:30:00Z"
}
```

### Step 4: Register Ticket in Pipeline API (MANDATORY — DO NOT SKIP)

**Execute all three API calls from [Mandatory API Calls](#mandatory-api-calls-execute-all-three) above.**

This is not optional. This is not documentation. You MUST make these HTTP requests right now.

1. `createTicket()` → save the returned ticket ID
2. `transitionState(id, 'RESEARCH')` → confirm state changed
3. `queueSync(id, 'update_status', { status: 'In Progress' })` → confirm queued

**If any call fails**, retry once. If it still fails, report the error prominently — do NOT silently continue.

### Step 5: Run Verification Script

After making the API calls, run the verification script to confirm everything worked:

```bash
bash scripts/verify-intake.sh TICKET_ID_OR_NOTION_PAGE_ID
```

**If the script is not available locally**, verify manually via the public API:

```bash
curl -s "${API_URL}/public/tickets/${TICKET_ID}" | jq '{id, state, title, notion_page_id}'
```

Expected output:

```json
{
  "id": "...",
  "state": "RESEARCH",
  "title": "...",
  "notion_page_id": "..."
}
```

**If `state` is not `RESEARCH`, go back to Step 4 and complete the missing calls.**

### Step 6: Output Summary and Handoff

Print a clear summary:

```markdown
## Ticket Intake Complete

**Source:** Notion | GitHub
**Title:** [Ticket title]
**ID:** abc12345
**Status:** In Progress (queued)
**Priority:** High
**Area:** UI

### Description

[Brief description or first 200 chars]

### Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

### Links

- **Ticket:** [Original URL]
- **Slack:** [Slack thread content fetched via slackdump] (Notion only)

### Pipeline

- **API Ticket ID:** abc12345
- **State:** RESEARCH
- **Verified:** ✅ (via verify-intake.sh or public API)
```

**After printing the summary, immediately handoff** to continue the pipeline. Use the `handoff` tool with all necessary context (ticket ID, source, title, description, slack context if any):

> **Handoff goal:** "Continue pipeline for ticket {ID} ({title}). Ticket is in RESEARCH state. Load skill: `research-orchestrator` to begin research phase. Ticket data: source={source}, notion_page_id={pageId}, priority={priority}. {slack context summary if available}"

**Do NOT wait for human approval to proceed.** The intake phase is complete — handoff immediately.

## Error Handling

### Unsupported URL

```
❌ Unsupported ticket URL format.

Supported formats:
- Notion: https://notion.so/... or https://www.notion.so/...
- GitHub: https://github.com/{owner}/{repo}/issues/{number}

Received: [provided URL]
```

### Provider-Specific Errors

See individual provider files for source-specific error handling:

- `providers/notion.md` - Authentication, page not found
- `providers/github.md` - Auth, rate limits, issue not found

### Missing Properties

Continue with available data and note what's missing:

```
⚠️ Some properties unavailable:
- Priority: not found (using default: Medium)
- Area: not found

Proceeding with available data...
```

### API Call Failures

```
❌ Pipeline API call failed: {method} {endpoint}
   Status: {status}
   Error: {message}

Retrying once...

❌ Retry also failed. INTAKE IS INCOMPLETE.
   The ticket was NOT registered in the pipeline.
   Downstream skills will not work until this is fixed.
```

## Notes

- This skill focuses ONLY on intake — it does not do research
- Slack thread content is fetched automatically via the `slackdump` skill — no manual copy-paste needed
- ALL API calls (createTicket, transitionState, queueSync) are MANDATORY — never skip them
- The `queueSync` action must be `"update_status"`, NOT `"UPDATE_NOTION_STATUS"`
- Pipeline state is tracked via the API, not local files
- Working artifacts (research-report.md, plan.md) can be saved locally to `$PIPELINE_DIR/runs/{ticket-id}/`
- The `source` field in the ticket determines which research strategies to use

## API Client Reference

### Available Methods

| Method                                                      | Description                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `createTicket({ notion_page_id, title, source, metadata })` | Create a new ticket in the API                                      |
| `getTicket(id)`                                             | Retrieve a ticket by ID                                             |
| `findByNotionId(notionPageId)`                              | Look up a ticket by its Notion page ID                              |
| `listTickets({ state, agent_id, limit, offset })`           | List tickets with optional filters                                  |
| `transitionState(id, state, reason)`                        | Move ticket to a new state (e.g., `'RESEARCH'`)                     |
| `setPRCreated(id, prUrl)`                                   | Mark ticket as having a PR created                                  |
| `queueSync(id, action, payload)`                            | Queue a sync action (`update_status`, `update_pr_url`, `mark_done`) |
| `registerBranch(id, branch, repo)`                          | Register working branch for automatic PR detection                  |

### Error Handling

```typescript
import { PipelineClient, PipelineAPIError } from '@pipeline/client';

try {
  await client.createTicket({ ... });
} catch (error) {
  if (error instanceof PipelineAPIError) {
    console.error(`API Error ${error.status}: ${error.message}`);
  }
  throw error;
}
```
