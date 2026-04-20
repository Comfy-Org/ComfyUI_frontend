---
name: bug-dump-ingest
description: 'Syncs the #bug-dump Slack channel into Linear as the system of record. Primary mode: bulk sync — every ingestable message becomes a Linear issue with labels (area, env, severity, reporter) in Triage state, marked in Slack via a :white_check_mark: reaction on the parent + a thread reply carrying the Linear URL. Respects the team emoji scheme (:white_check_mark: ticket created, :pr-open: PR open, :question: needs context, :repeat: duplicate). Secondary mode: delegate to red-green-fix for explicitly-approved fixes. Use when asked to sync #bug-dump to Linear, triage slack bugs, run a bug-dump sweep, or ingest bug reports. Triggers on: bug-dump, sync bug-dump, ingest bugs, triage slack bugs, bug sweep.'
---

# Bug Dump Ingest

**Primary job: sync `#bug-dump` (Slack: `C0A4XMHANP3`) into Linear as the source of truth.** Linear is where status, labels, and follow-up triage happen — this skill just gets every bug into Linear with enough context that a downstream agent or human can work from Linear alone, not from Slack.

Fix workflows (red-green tests, PRs) are a **secondary, opt-in pass** triggered per-candidate with `F`. The default flow files tickets and stops.

```
fetch → verify false defects → present approvals → create Linear (with labels, Triage state)
      → thread reply ":white_check_mark: Filed to Linear" (ingested marker)
      → [optional] delegate to red-green-fix → unit/e2e tests → PR
```

The skill does NOT auto-add Slack reactions (no `reactions.add` tool is exposed). Instead:

- The **machine-readable ingested marker** is a thread reply whose TEXT starts with `:white_check_mark:` and includes the Linear URL. That string is searchable (`has:link has::white_check_mark:`) and idempotent.
- The **visible parent-message marker** is a `:white_check_mark:` reaction on the original message — added manually by the human (the skill prints a batch list of permalinks + Linear IDs after each run).

Both markers are respected by Processed Detection on subsequent sweeps.

### Team emoji scheme

| Emoji                | Meaning            | Who adds it                                            | Skill behavior                                 |
| -------------------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| `:white_check_mark:` | Ticket created     | Human on parent (after skill files); also in bot reply | Skip in future sweeps                          |
| `:pr-open:`          | PR open            | Human                                                  | Skip creation; include PR link in approval row |
| `:question:`         | Needs more context | Human                                                  | Skip creation; agent may ask for clarification |
| `:repeat:`           | Duplicate          | Human                                                  | Skip creation; link existing Linear issue      |

## Design Priority

Optimize for **coverage and label quality** over fix-path cleverness. Linear is the downstream triage surface — once every bug is there with status, labels, and context, agents and humans can work from Linear alone. A Linear ticket with a wrong severity is cheap to fix; a Slack-only bug is invisible to downstream tooling.

## Quick Start

1. **Scope** — default window: messages in the last 48h. Override with `--since YYYY-MM-DD` or a Slack permalink list.
2. **Fetch** — `slack_read_channel` for `C0A4XMHANP3`; `slack_read_thread` per message with replies.
3. **Filter** — drop already-processed (see Processed Detection).
4. **Classify** — bug / discussion / meta (see Classification Rules).
5. **Verify false defects** — per candidate, run quick checks before proposing (see False-Defect Verification).
6. **Extract** — normalize to ticket schema (see Ticket Schema).
7. **Dedupe** — search Linear for open issues with overlapping title/body terms.
8. **Human approval** — batch table, collect Y/N/?/F per candidate (see Interactive Approval). `F` = file and fix now.
9. **Create Linear** — one issue per approved candidate; attach Slack permalink.
10. **Thread reply (ingested marker)** — `slack_send_message` with `thread_ts` set, message starts with `:white_check_mark: Filed to Linear: <URL>`.
11. **Fix (for `F` candidates)** — delegate to `red-green-fix` skill: failing unit + e2e tests first, then minimal fix, then PR.
12. **Log** — append to session log; update `processed.json`.

## System Context

| Item               | Value                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Source channel     | `#bug-dump` (`C0A4XMHANP3`)                                                                                                       |
| Destination        | Linear — default team: `Frontend Engineering` (resolve `teamId` and `key` at session start via `teams { nodes { id key name } }`) |
| Default state      | `Triage` — created tickets land here for downstream sorting                                                                       |
| State dir          | `~/temp/bug-dump-ingest/`                                                                                                         |
| Processed registry | `~/temp/bug-dump-ingest/processed.json`                                                                                           |
| Session log        | `~/temp/bug-dump-ingest/session-YYYY-MM-DD.md`                                                                                    |
| Drafts (no-MCP)    | `~/temp/bug-dump-ingest/drafts/*.md`                                                                                              |

## Label Taxonomy

Every created Linear issue MUST get the following labels (create labels in Linear if they don't exist yet):

| Label kind   | Values                                                                         | Source                    |
| ------------ | ------------------------------------------------------------------------------ | ------------------------- |
| `source:`    | `source:bug-dump`                                                              | Always (marks Slack sync) |
| `area:`      | `area:ui`, `area:node-system`, `area:workflow`, `area:cloud`, `area:templates` | Area Heuristics           |
| `env:`       | `env:cloud-prod`, `env:cloud-dev`, `env:local`, `env:electron`                 | Env Heuristics            |
| `severity:`  | `sev:high`, `sev:medium`, `sev:low`                                            | Severity Heuristics       |
| `reporter:`  | `reporter:<slack-handle>` (kebab-case)                                         | From message author       |
| Status flags | `needs-repro`, `needs-backend`, `regression`, `pr-open`                        | When applicable           |

Label rules:

- Always include `source:bug-dump`, exactly one `area:`, at least one `env:` (or `env:unknown`), exactly one `severity:`, exactly one `reporter:`.
- `needs-repro` — set when repro steps were ambiguous; signals "human should confirm before fix".
- `needs-backend` — set when fix is clearly in ComfyUI backend, not this frontend repo.
- `regression` — set when the bug mentions a version/upgrade correlation.
- `pr-open` — set instead of creating a fresh ticket when a fix PR already exists; the Linear issue becomes a tracker.

Labels are the primary affordance for downstream triage — invest in getting them right, not just in the title.

## Processed Detection

A top-level message is considered already-handled (skip creation) if ANY of:

- Its timestamp appears in `processed.json`.
- It carries a `:white_check_mark:` reaction on the parent — ticket already created.
- It carries a `:pr-open:` reaction — fix PR is open; skill records the PR link in the session log rather than creating a fresh Linear issue.
- It carries a `:repeat:` reaction — duplicate; skill attempts to find the original Linear issue and link it in the session log.
- It carries a `:question:` reaction — needs more context; skill skips creation and records for follow-up.
- Its thread contains a reply with a `https://linear.app/` URL (fetch via `slack_read_thread`).
- Its thread contains a reply starting with `:white_check_mark:` from the skill's bot user.
- It is a system/meta message (`has joined the channel`, bot-only message).
- Its thread already contains resolution confirmation (`"solved"`, `"resolved"`, `:done:` reaction from the reporter) AND has no fix PR referenced — treat as "resolved without ticket, skip".

Never re-ingest a message already marked in any of the above ways.

Filter query for Slack search-based sweeps:

```
in:<#C0A4XMHANP3> -has::white_check_mark: -has::pr-open: -has::repeat: -has::question: after:YYYY-MM-DD
```

## False-Defect Verification

Before a candidate hits the approval batch, run cheap checks to demote obvious non-bugs. Goal: keep the approval table high-signal. This is not a full repro — just fast heuristics that catch the top false-positive classes.

| Check                                    | Command / Signal                                                 | Demote-to  |
| ---------------------------------------- | ---------------------------------------------------------------- | ---------- |
| Reporter self-resolved in same msg       | "no action needed", "solved", "nvm", "fixed it"                  | `resolved` |
| Reporter self-resolved in thread         | `slack_read_thread` → reporter's last reply contains "solved"    | `resolved` |
| Fix PR merged on main                    | `gh search prs "in:title <keyword>" --state merged --limit 3`    | `fixed`    |
| Fix PR open (already-filed)              | `gh search prs "<keyword>" --state open --limit 3`               | `pr-open`  |
| Linear issue exists (open)               | Linear `searchIssues` on title keywords → any open match         | `dedupe`   |
| Behavior is documented / intended        | grep `docs/` and `src/locales/en/*.json` for the feature         | `expected` |
| Not reproducible — feature doesn't exist | grep `src/` for mentioned component/feature → 0 hits             | `stale`    |
| Env drift only (local setup issue)       | Thread contains "my machine", "my setup", "proxy" without others | `env`      |

For each demoted candidate, record the demotion reason in the approval table as `Verify: <tag>` so the human can override if they disagree. Never hard-skip based on verification alone — always show the row with the demotion.

### Recommended verify commands

```bash
# 1. Search recent PRs for the feature in question
gh search prs "<keyword>" --repo Comfy-Org/ComfyUI_frontend --limit 5

# 2. Grep for the feature / component mentioned
rg -l "<ComponentOrFeatureName>" src/ apps/

# 3. Check if it's a known i18n / documented setting
rg "<setting-key>" src/locales/en/ docs/
```

Keep verification under ~30s per candidate. If it takes longer, propose a ticket and let the human decide — don't let verification become the bottleneck.

## Classification Rules

For each unprocessed top-level message, decide:

| Class             | Signal                                                                                                    | Action                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **bug**           | Describes unexpected behavior, visual glitch, error, regression, crash. Usually has repro steps or media. | Propose Linear ticket        |
| **discussion**    | Design question, rollout thoughts, team chatter, PR planning (e.g. "how about we make a PR to do...")     | Skip                         |
| **question**      | User asking if something is expected or known                                                             | Skip unless answered = bug   |
| **meta**          | Channel joins, bot messages, cross-posts without content                                                  | Skip                         |
| **already-filed** | Thread shows PR already open OR existing Linear link                                                      | Skip, log with existing link |

When ambiguous, default to **bug** and let the human decide in the approval batch.

## Ticket Schema

Normalize each bug to this shape before presenting:

```json
{
  "slack_ts": "1776639963.837519",
  "slack_permalink": "https://comfy-organization.slack.com/archives/C0A4XMHANP3/p1776639963837519",
  "reporter": "Ali Ranjah (wavey)",
  "title": "Unet model dropdown missing selected model",
  "description": "Body with repro steps, env, attachments list, thread summary",
  "env": ["cloud prod"],
  "severity": "low | medium | high",
  "area": "ui | node-system | workflow | cloud | templates | unknown",
  "attachments": [{ "name": "...", "id": "F...", "type": "image/png" }],
  "thread_resolution": "solved | open | none"
}
```

Keep descriptions copy-paste friendly: lead with repro bullets, then env, then "See Slack: <permalink>". Attach thread summary only if it adds context beyond the top-level message.

### Severity Heuristics

- **high** — crash, data loss, blocks a template or core feature, affects paying users broadly (e.g. "job ends in 30m on Pro", "widget values reset").
- **medium** — visible regression, template error, wrong pricing, broken UX on a common path.
- **low** — cosmetic, single-template edge case, minor tooltip/boundary issue.

When unsure, mark `medium` and flag for human in the approval batch.

### Area Heuristics

- `ui` — visual glitches, palette issues, popover clipping, dropdown styling.
- `node-system` — canvas perf, reroute, node drag, widget rendering, undo.
- `workflow` — template failures, save/load, refresh regressions.
- `cloud` — jobs, pricing, assets, auth, queue.
- `templates` — specific template errors.

## Dedupe

Before proposing a ticket:

1. Extract 3-5 keyword terms from the title (strip stopwords).
2. Query Linear for open issues matching any term (Linear MCP `searchIssues` or GraphQL `issues(filter:{state:{type:{nin:["completed","canceled"]}}})`).
3. If a clear duplicate (≥80% title overlap or same stack trace), mark `Dedup? Y → LIN-NNN` in the approval table and propose linking instead of creating.

## Interactive Approval

Present candidates in batches of 5-10. Table format (9 columns):

```
 #  | Slack (author, time)   | Proposed title                          | Env        | Sev  | Area       | Dedup      | Verify      | Rec
----+------------------------+-----------------------------------------+------------+------+------------+------------+-------------+-----
 1  | wavey, 04-20 08:06     | Unet dropdown missing selected model    | cloud prod | low  | ui         | N          | resolved    | N
 2  | Denys, 04-18 05:45     | Pro plan jobs end at 30 minutes         | cloud prod | high | cloud      | N          | clean       | Y
 3  | Terry Jia, 04-18 12:52 | Nodes 2.0 canvas lag on large workflows | -          | high | node-system| ? LIN-4521 | clean       | L
```

Each row must show: Slack author + date, proposed title, env tags, severity, area, dedupe status, verify tag (from False-Defect Verification), and agent recommendation.

### Response format

- `Y` — create Linear ticket only (default after → human adds `:white_check_mark:` to parent)
- `F` — create Linear ticket AND delegate to red-green-fix right now (bot posts `:pr-open:` reply when PR opens)
- `N` — skip (log reason in session file)
- `?` — mark as needs-context; skill may post a thread reply asking for repro details and prompts the human to add `:question:` to the parent
- `L` — link to existing Linear issue instead of creating (agent asks which one if dedupe didn't find it)
- `R` — duplicate of another bug-dump message or Linear issue; skill links the two and prompts human for `:repeat:` on the parent
- `E` — edit proposed title/description before creating (agent shows draft for inline tweaks)
- Bulk responses accepted: `1 Y, 2 F, 3 R LIN-4521, 4 N, 5 ?`

Do not create any Linear issues until all candidates in the batch have a terminal decision. Fix-path (`F`) candidates are deferred until after Linear creation so every fix PR has a linkable `Fixes LIN-NNN`.

## Linear Integration

### Setup (one-time, per machine)

Pick ONE of the following. The skill detects which is active at run time and uses it.

**Option A — Official Linear MCP (recommended, OAuth-based, no API key):**

Register via the Claude CLI at user scope (no repo edits):

```bash
claude mcp add --transport sse --scope user linear https://mcp.linear.app/sse
```

Restart your Claude Code session. On first call to a `mcp__linear__*` tool, Claude Code opens a browser flow to authorize. Tokens are stored by the MCP server — no `LINEAR_API_KEY` in env.

Alternative: check it into the repo via `.mcp.json` (shared config) and pre-approve it in `.claude/settings.local.json`:

```jsonc
// .mcp.json (repo root, committed)
{
  "mcpServers": {
    "linear": { "type": "sse", "url": "https://mcp.linear.app/sse" }
  }
}
```

```jsonc
// .claude/settings.local.json (gitignored, per-user)
{ "enabledMcpjsonServers": ["linear"] }
```

**Option B — Community / self-hosted Linear MCP (API key in config):**

Register via CLI, passing `LINEAR_API_KEY` through stdio env:

```bash
claude mcp add --scope user linear -- npx -y @tacticlaunch/mcp-linear
# then set LINEAR_API_KEY in the shell the MCP server starts from
```

Or write `.mcp.json` directly:

```jsonc
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@tacticlaunch/mcp-linear"],
      "env": { "LINEAR_API_KEY": "lin_api_..." }
    }
  }
}
```

Get `lin_api_...` from Linear → Settings → API → Personal API keys.

**Option C — No MCP, use GraphQL directly (slowest, still per-run):**

```bash
export LINEAR_API_KEY="lin_api_..."
```

Then the skill uses `curl` against `https://api.linear.app/graphql` per `reference/linear-api.md`.

### Resolution order at run time

1. **Linear MCP** — if `mcp__linear__*` tools are present, use `createIssue` / `searchIssues` / `listTeams`. Prefer this path.
2. **Linear GraphQL** — if `LINEAR_API_KEY` is set, use curl.
3. **Draft fallback** — if neither, write one markdown file per approved ticket into `~/temp/bug-dump-ingest/drafts/NN-short-slug.md` and ask the human to paste. Still post a Slack thread reply, but worded as "Drafted — awaiting Linear link" (do NOT include `:white_check_mark:` until a real Linear URL exists, otherwise the ingested marker is a lie).

Never invent a Linear URL. If creation fails, the thread reply must NOT pretend a ticket exists — reply with a clear "ingestion failed, see drafts" message instead.

### Per-issue Linear fields to populate

Every successful create must set:

- `teamId` — FRONTEND team (cached from session setup)
- `stateId` — Triage state (cached from session setup)
- `title` — concise noun phrase (see Ticket Schema § title)
- `description` — markdown body (see `reference/linear-api.md` Description Template)
- `labelIds` — label set per Label Taxonomy; create missing labels via `labelCreate` before the issue create
- `attachments` (via `attachmentCreate` or description links) — Slack permalink for source

If any of these fail, create the ticket without the failing optional field AND log the partial failure to the session log so the human can patch afterward. Do NOT abort an otherwise-valid create because a single label is missing.

## Slack Thread Reply (Ingested Marker)

After (successful) Linear creation, post a threaded reply on the original message via `slack_send_message` with `thread_ts` set to the top-level message ts. The reply MUST start with `:white_check_mark:` and include the Linear URL — that's the ingested marker used by future runs' filtering:

```
:white_check_mark: Filed to Linear: <LINEAR_URL>
Reporter: <@USER_ID>
Sev: <severity>  •  Area: <area>
```

Keep the rest plain text — no markdown tables, no bold. The leading `:white_check_mark:` emoji is NOT decorative — it's the canonical ingested marker because the reactions API isn't available. Future runs filter via Slack search `has:link has::white_check_mark: from:me in:<#C0A4XMHANP3>`.

### Mark the parent message (human step — mandatory for sync visibility)

Thread replies are collapsed in the channel, so the parent message isn't visibly marked until the human adds a `:white_check_mark:` reaction. The skill can't set reactions (no `reactions.add` tool), so after each batch it MUST print a ready-to-use action list:

```
Add :white_check_mark: to these parent messages in #bug-dump (click emoji → search "white check"):

1. https://comfy-organization.slack.com/archives/C0A4XMHANP3/p1776639963837519  → LIN-4710
2. https://comfy-organization.slack.com/archives/C0A4XMHANP3/p1776592837616399  → LIN-4711
3. ...

(These won't be re-ingested on the next sweep thanks to processed.json, but the :white_check_mark: reaction is the team's visible "handled" indicator in-channel.)
```

If any candidates were `?` (needs context), `R` (duplicate), or already had open PRs, add matching instruction blocks for `:question:`, `:repeat:`, and `:pr-open:` reactions so the channel stays consistent with the team scheme.

Group the list under a clear heading at the end of the session. This is the authoritative ingested marker for humans; the thread reply is the authoritative marker for the skill.

### Why two markers (reaction + thread reply)

- `:white_check_mark:` **reaction on the parent** — visible in the channel at a glance; catches the eye of humans scanning for unhandled reports.
- `:white_check_mark:` **thread reply with Linear URL** — scriptable, survives if the reaction is removed, carries the Linear link.

Keeping both is cheap and makes processed detection robust to either signal drifting.

### Fix-path reply (after red-green-fix creates a PR)

If the candidate was `F` (file and fix), post a second thread reply when the PR opens — using the team's `:pr-open:` emoji so it aligns with the channel scheme:

```
:pr-open: Fix PR: <PR_URL>
Red-green verified: <unit or e2e> test proves the regression.
```

Prompt the human to add a `:pr-open:` reaction to the parent (replacing the `:white_check_mark:` from ingest if appropriate, or keeping both — it's the team's call).

## Fix Workflow (delegated to red-green-fix)

For candidates approved with `F`, after the Linear issue is created, hand off to the `red-green-fix` skill. That skill already enforces the two-commit red-green sequence — this section covers just the bug-dump-specific wiring.

### Inputs passed to red-green-fix

- **Bug description** — the Linear description (includes repro, env, source permalink).
- **Linear ID** — inserted into the PR body as `Fixes <LIN-ID>`.
- **Branch name** — `fix/<lin-id>-<short-slug>` (e.g. `fix/lin-4711-pro-plan-30min-timeout`).
- **Test layer** — inferred from `area`:
  - `ui` → unit (Vitest) + e2e (Playwright)
  - `node-system` → e2e primarily; unit if isolable
  - `workflow` / `templates` → e2e
  - `cloud` → unit if client-side logic, otherwise flag "backend — out of scope for this repo"

### Test authoring rules

Both tests MUST be written in the "red" commit BEFORE any fix code (per red-green-fix). Rules specific to bug-dump ingestion:

- **Unit test (Vitest)** — colocated next to the implementation, `<file>.test.ts`. Exercise the specific logic path reproduced by the reporter. One `describe` block named after the Linear ID:

  ```typescript
  // src/components/node/UnetDropdown.test.ts
  describe('LIN-4710: unet dropdown missing selected model', () => {
    it('includes the currently-selected model in the list even when not in available models', () => {
      // ...
    })
  })
  ```

- **E2E test (Playwright)** — under `browser_tests/tests/`, follow `writing-playwright-tests` skill. Tag with `@regression` and include the Linear ID in the test title:

  ```typescript
  test.describe(
    'LIN-4710 unet dropdown regression',
    { tag: ['@regression'] },
    () => {
      test('keeps selected model visible in the dropdown', async ({
        comfyPage
      }) => {
        // ...
      })
    }
  )
  ```

- **Mock data types** — follow `docs/guidance/playwright.md`: mock responses typed from `packages/ingest-types`, `packages/registry-types`, `src/schemas/` — never `as any`.

### Handoff conditions (when NOT to auto-fix)

Bug-dump-ingest must NOT start red-green-fix and instead emit a human nudge when:

- Repro steps are incomplete (no clear numbered steps, no env) — reply in thread: "Need clearer repro before I can write a failing test. What's the shortest path to reproduce?"
- Fix requires backend / ComfyUI repo changes (not frontend) — label Linear `needs-backend` and skip fix path.
- Linear issue was dedupe-linked rather than newly created — existing owner may already be fixing.
- Severity is cosmetic AND reporter hasn't asked for a fix — file ticket only.
- Fix would touch `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph` god-objects (ADR-0003/0008 — always human decision).

### PR body template

The red-green-fix skill's PR template is extended with a `Source` line:

```markdown
## Summary

<Root cause>

- Fixes LIN-NNN
- Source: Slack <permalink>

## Red-Green Verification

| Commit                                     | CI Status            | Purpose                         |
| ------------------------------------------ | -------------------- | ------------------------------- |
| `test: LIN-NNN add failing test for <bug>` | :red_circle: Red     | Proves the test catches the bug |
| `fix: <bug summary>`                       | :green_circle: Green | Proves the fix resolves the bug |

## Test Plan

- [ ] Unit regression test passes locally
- [ ] E2E regression test passes locally (if UI)
- [ ] Manual repro no longer reproduces
- [ ] Linear ticket linked
```

After the PR merges, post the second thread reply on Slack (see Slack Thread Reply § Fix-path reply).

## Emoji Reaction Hints (read-only)

The agent cannot add reactions, but respects human-set reactions when filtering. The canonical team scheme (primary):

| Reaction             | Meaning            | Action                                                   |
| -------------------- | ------------------ | -------------------------------------------------------- |
| `:white_check_mark:` | Ticket created     | Skip — already ingested                                  |
| `:pr-open:`          | PR open            | Skip creation; record PR link in session log             |
| `:question:`         | Needs more context | Skip creation; agent may post a thread reply asking      |
| `:repeat:`           | Duplicate          | Skip creation; link existing Linear issue in session log |

Incidental reactions observed in the channel — treat as soft hints only, do NOT skip solely on these:

| Reaction | Meaning             | Action                                             |
| -------- | ------------------- | -------------------------------------------------- |
| `:eyes:` | Someone is triaging | Still ingestable                                   |
| `:done:` | Reporter resolved   | Demote to `resolved` in verify, but still show row |
| `:+1:`   | Acknowledged        | Ignore                                             |

Approval-table response code `R` (new) corresponds to `:repeat:` — if you pick `R`, the skill treats it as duplicate and asks for the target Linear ID.

## Session Log

Append to `~/temp/bug-dump-ingest/session-YYYY-MM-DD.md`:

```
Bug Dump Ingest Session -- 2026-04-20 11:40 KST

Window: 2026-04-18 00:00 — 2026-04-20 12:00 KST
Scanned: 28 top-level messages
Skipped (meta/discussion/processed): 14
Proposed: 14
Approved: 11
Created in Linear: 10
Draft-only (creation failed): 1
Linked-only (dedupe): 1
Thread replies posted: 11

Created:
- LIN-4710 Unet model dropdown missing selected model -- wavey -- low/ui
- LIN-4711 Pro plan jobs end at 30 minutes -- Denys -- high/cloud
- ...

Skipped with reason:
- 1776592837.616399 -- design discussion in thread, not a bug
- ...
```

## Gotchas

### Thread summaries, not raw dumps

Pulling the full thread often adds noise. Summarize replies to: (a) confirmed reproductions by other users, (b) env/version details added in replies, (c) links to related PRs/commits. Drop emojis-only replies, joined-channel notifications, and off-topic chatter.

### Cross-posts are not bugs

When the top-level message is just a link to a Slack message in another channel (e.g. "X posting" with a URL and nothing else), follow the link to the original source and ingest from there — do NOT create a ticket from the cross-post itself.

### Resolved-in-thread messages

If the reporter replies `"No action needed, this is solved"` (see wavey 2026-04-20 08:06), mark the ticket for SKIP in the approval table, not auto-skip. The human may still want a regression test ticket.

### Permalinks

Construct Slack permalinks as:

```
https://comfy-organization.slack.com/archives/{CHANNEL_ID}/p{TS_WITH_DOT_REMOVED}
```

E.g. `1776510375.473579` → `p1776510375473579`.

### Attachment handling

Slack file IDs (e.g. `F0AT...`) are private. Do NOT link them directly in Linear. Instead, list the filename and type in the Linear description and include the Slack permalink — anyone with Slack access can see the attachments from the thread.

### No auto-create without approval

Never create Linear issues without a human `Y`. This is a hard rule — the skill exists to reduce human toil, not to replace triage judgment.

## Reference Files

- `reference/linear-api.md` — GraphQL snippets for create/search/link.
- `reference/schema.md` — full ticket schema with field-by-field extraction notes.
- `reference/examples.md` — worked examples drawn from real #bug-dump messages.
- `reference/verify-commands.md` — cookbook of false-defect verification commands per bug class.

## Related Skills

- `red-green-fix` — invoked for `F` candidates to implement the fix with a proven regression test.
- `writing-playwright-tests` — used by red-green-fix when an e2e test is needed.
- `hardening-flaky-e2e-tests` — if the e2e test added in the fix PR starts flaking, jump to this skill.
