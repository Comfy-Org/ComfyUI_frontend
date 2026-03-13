# Notion Provider - Ticket Intake

Provider-specific logic for ingesting tickets from Notion.

## URL Pattern

```
https://www.notion.so/workspace/Page-Title-abc123def456...
https://notion.so/Page-Title-abc123def456...
https://www.notion.so/abc123def456...
```

Page ID is the 32-character hex string (with or without hyphens).

## Prerequisites

- Notion MCP connected and authenticated
- If not setup: `claude mcp add --transport http notion https://mcp.notion.com/mcp`
- Authenticate via `/mcp` command if prompted

## Fetch Ticket Content

Use `Notion:notion-fetch` with the page URL or ID:

```
Fetch the full page content including all properties
```

## Extract Ticket Data

Extract these properties (names may vary):

| Property      | Expected Name             | Type         |
| ------------- | ------------------------- | ------------ |
| Title         | Name / Title              | Title        |
| Status        | Status                    | Select       |
| Assignee      | Assignee / Assigned To    | Person       |
| Description   | -                         | Page content |
| Slack Link    | Slack Link / Slack Thread | URL          |
| GitHub PR     | GitHub PR / PR Link       | URL          |
| Priority      | Priority                  | Select       |
| Area          | Area / Category           | Select       |
| Related Tasks | Related Tasks             | Relation     |

**If properties are missing**: Note what's unavailable and continue with available data.

## Update Source (REQUIRED)

**⚠️ DO NOT SKIP THIS STEP. This is a required action, not optional.**

**⚠️ Notion Write Safety rules apply (see `$PIPELINE_DIR/docs/notion-write-safety.md` for full reference):**

- **Whitelist**: Only `Status`, `GitHub PR`, and `Assignee` fields may be written
- **Valid transitions**: Not Started → In Progress, In Progress → In Review, In Review → Done
- **Logging**: Every write attempt MUST be logged with timestamp, field, value, previous value, skill name, and success status

Use `Notion:notion-update-page` to update the ticket:

1. **Status**: Set to "In Progress" (only valid from "Not Started")
2. **Assignee**: Assign to pipeline owner (Notion ID: `175d872b-594c-81d4-ba5a-0002911c5966`)

```json
{
  "page_id": "{page_id_from_ticket}",
  "command": "update_properties",
  "properties": {
    "Status": "In Progress",
    "Assignee": "175d872b-594c-81d4-ba5a-0002911c5966"
  }
}
```

**After the update succeeds**, log the write via the Pipeline API:

```typescript
await client.updateTicket(ticketId, {
  metadata: {
    ...ticket.metadata,
    notionWrites: [
      ...(ticket.metadata?.notionWrites || []),
      {
        field: 'Status',
        value: 'In Progress',
        previousValue: 'Not Started',
        at: new Date().toISOString(),
        skill: 'ticket-intake',
        success: true
      }
    ]
  }
})
```

If update fails, log with `success: false` and continue.

## Notion-Specific Ticket Fields

Store via API using `client.createTicket()`:

```json
{
  "source": "notion",
  "notionPageId": "abc123def456...",
  "slackLink": "https://slack.com/...",
  "relatedTasks": ["page-id-1", "page-id-2"]
}
```

## Slack Thread Handling

If a Slack link exists, use the `slackdump` skill to fetch the thread content programmatically.

### Slack URL Conversion

Notion stores Slack links in `slackMessage://` format:

```
slackMessage://comfy-organization.slack.com/CHANNEL_ID/THREAD_TS/MESSAGE_TS
```

Convert to browser-clickable format:

```
https://comfy-organization.slack.com/archives/CHANNEL_ID/pMESSAGE_TS_NO_DOT
```

**Example:**

- Input: `slackMessage://comfy-organization.slack.com/C075ANWQ8KS/1766022478.450909/1764772881.854829`
- Output: `https://comfy-organization.slack.com/archives/C075ANWQ8KS/p1764772881854829`

(Remove the dot from the last timestamp and prefix with `p`)

### Fetching Thread Content

Load the `slackdump` skill and use the **export-thread** workflow:

```bash
# Export thread by URL
slackdump dump "https://comfy-organization.slack.com/archives/CHANNEL_ID/pMESSAGE_TS"

# Or by colon notation (channel_id:thread_ts)
slackdump dump CHANNEL_ID:THREAD_TS
```

Save the thread content to `$RUN_DIR/slack-context.md` and include it in the ticket metadata.

> **No manual action required.** The slackdump CLI handles authentication via stored credentials at `~/.cache/slackdump/comfy-organization.bin`.

## Database Reference: Comfy Tasks

The "Comfy Tasks" database has these properties (verify via `notion-search`):

- **Status values**: Not Started, In Progress, In Review, Done
- **Team assignment**: "Frontend Team" for unassigned tickets
- **Filtering note**: Team filtering in Notion may have quirks - handle gracefully

### Pipeline Owner Details

When assigning tickets, use these identifiers:

| Platform        | Identifier                             |
| --------------- | -------------------------------------- |
| Notion User ID  | `175d872b-594c-81d4-ba5a-0002911c5966` |
| Notion Name     | Christian Byrne                        |
| Notion Email    | cbyrne@comfy.org                       |
| Slack User ID   | U087MJCDHHC                            |
| GitHub Username | christian-byrne                        |

**To update Assignee**, use the Notion User ID (not name):

```
properties: {"Assignee": "175d872b-594c-81d4-ba5a-0002911c5966"}
```

### Finding Active Tickets

To list your active tickets:

```
Use Notion:notion-search for "Comfy Tasks"
Filter by Assignee = current user OR Team = "Frontend Team"
```

## Error Handling

### Authentication Error

```
⚠️ Notion authentication required.
Run: claude mcp add --transport http notion https://mcp.notion.com/mcp
Then authenticate via /mcp command.
```

### Page Not Found

```
❌ Notion page not found or inaccessible.
- Check the URL is correct
- Ensure you have access to this page
- Try re-authenticating via /mcp
```
