# GitHub Provider - Ticket Intake

Provider-specific logic for ingesting tickets from GitHub Issues.

## URL Pattern

```
https://github.com/{owner}/{repo}/issues/{number}
https://www.github.com/{owner}/{repo}/issues/{number}
```

Extract: `owner`, `repo`, `issue_number` from URL.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Access to the repository

## Fetch Issue Content

Use `gh` CLI to fetch issue details:

```bash
# Get issue details in JSON
gh issue view {number} --repo {owner}/{repo} --json title,body,state,labels,assignees,milestone,author,createdAt,comments,linkedPRs

# Get comments separately if needed
gh issue view {number} --repo {owner}/{repo} --comments
```

## Extract Ticket Data

Map GitHub issue fields to normalized ticket data (stored via API):

| GitHub Field | ticket.json Field | Notes                      |
| ------------ | ----------------- | -------------------------- |
| title        | title             | Direct mapping             |
| body         | description       | Issue body/description     |
| state        | status            | Map: open → "Not Started"  |
| labels       | labels            | Array of label names       |
| assignees    | assignee          | First assignee login       |
| author       | author            | Issue author login         |
| milestone    | milestone         | Milestone title if present |
| comments     | comments          | Array of comment objects   |
| linkedPRs    | linkedPRs         | PRs linked to this issue   |

### Priority Mapping

Infer priority from labels:

- `priority:critical`, `P0` → "Critical"
- `priority:high`, `P1` → "High"
- `priority:medium`, `P2` → "Medium"
- `priority:low`, `P3` → "Low"
- No priority label → "Medium" (default)

### Area Mapping

Infer area from labels:

- `area:ui`, `frontend`, `component:*` → "UI"
- `area:api`, `backend` → "API"
- `area:docs`, `documentation` → "Docs"
- `bug`, `fix` → "Bug"
- `enhancement`, `feature` → "Feature"

## Update Source

**For GitHub issues, update is optional but recommended.**

Add a comment to indicate work has started:

```bash
gh issue comment {number} --repo {owner}/{repo} --body "🤖 Pipeline started processing this issue."
```

Optionally assign to self:

```bash
gh issue edit {number} --repo {owner}/{repo} --add-assignee @me
```

Log any updates via the Pipeline API:

```typescript
await client.updateTicket(ticketId, {
  metadata: {
    ...ticket.metadata,
    githubWrites: [
      ...(ticket.metadata?.githubWrites || []),
      {
        action: 'comment',
        issueNumber: 123,
        at: new Date().toISOString(),
        skill: 'ticket-intake',
        success: true
      }
    ]
  }
})
```

## GitHub-Specific Ticket Fields

Store via API using `client.createTicket()`:

```json
{
  "source": "github",
  "githubOwner": "Comfy-Org",
  "githubRepo": "ComfyUI_frontend",
  "githubIssueNumber": 123,
  "githubIssueUrl": "https://github.com/Comfy-Org/ComfyUI_frontend/issues/123",
  "labels": ["bug", "area:ui", "priority:high"],
  "linkedPRs": [456, 789],
  "dosuComment": "..." // Extracted Dosu bot analysis if present
}
```

## Dosu Bot Detection

Many repositories use Dosu bot for automated issue analysis. Check comments for Dosu:

```bash
gh issue view {number} --repo {owner}/{repo} --comments | grep -A 100 "dosu"
```

Look for comments from:

- `dosu[bot]`
- `dosu-bot`

Extract Dosu analysis which typically includes:

- Root cause analysis
- Suggested files to modify
- Related issues/PRs
- Potential solutions

Store in ticket data via API:

```json
{
  "dosuComment": {
    "found": true,
    "analysis": "...",
    "suggestedFiles": ["src/file1.ts", "src/file2.ts"],
    "relatedIssues": [100, 101]
  }
}
```

## Extract Linked Issues/PRs

Parse issue body and comments for references:

- `#123` → Issue or PR reference
- `fixes #123`, `closes #123` → Linked issue
- `https://github.com/.../issues/123` → Full URL reference

Store in ticket data via API for research phase:

```json
{
  "referencedIssues": [100, 101, 102],
  "referencedPRs": [200, 201]
}
```

## Error Handling

### Authentication Error

```
⚠️ GitHub CLI not authenticated.
Run: gh auth login
```

### Issue Not Found

```
❌ GitHub issue not found or inaccessible.
- Check the URL is correct
- Ensure you have access to this repository
- Run: gh auth status
```

### Rate Limiting

```
⚠️ GitHub API rate limited.
Wait a few minutes and try again.
Check status: gh api rate_limit
```
