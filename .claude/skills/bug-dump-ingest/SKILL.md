---
name: bug-dump-ingest
description: 'Syncs the #bug-dump Slack channel into Linear as the system of record AND auto-fixes verified real bugs via red-green-fix. Flow: fetch → mandatory dedupe gate (Linear + gh PR search) → false-defect verification → file Linear (Triage, labeled) → post :white_check_mark: thread reply via slack_send_message (mandatory tool call, not chat output) → if candidate is a verified real bug with no dedupe hit and no open PR, invoke red-green-fix automatically to produce failing test + fix + PR. Respects team emoji scheme (:white_check_mark: ticket created, :pr-open: PR open, :question: needs context, :repeat: duplicate). Use when asked to sync #bug-dump to Linear, triage slack bugs, run a bug-dump sweep, or ingest bug reports. Triggers on: bug-dump, sync bug-dump, ingest bugs, triage slack bugs, bug sweep.'
---

# Bug Dump Ingest

**Primary job: sync `#bug-dump` (Slack: `C0A4XMHANP3`) into Linear as the source of truth, then auto-fix the verified real bugs.** Linear is where status, labels, and follow-up triage happen — this skill gets every bug into Linear with enough context that a downstream agent or human can work from Linear alone. When pre-flight verification confirms a candidate is a real bug (not dedupe, not already in a PR, not out of scope), the skill then invokes `red-green-fix` automatically.

```text
fetch → pre-flight dedupe gate (Linear + gh) → verify false defects → present approvals
      → create Linear (with labels, Triage state)
      → POST :white_check_mark: thread reply via slack_send_message  (mandatory tool call)
      → if verification = "real bug" AND no dedupe AND no open PR:
          invoke Skill(skill="red-green-fix") → POST :pr-open: thread reply
```

### Non-negotiable rules

1. **The thread reply is a tool call, not chat output.** The skill MUST call `mcp__plugin_slack_slack__slack_send_message` with `thread_ts` set. Printing `:white_check_mark: Filed to Linear: ...` into the Claude CLI response is NOT a substitute — the Slack thread is the canonical ingested marker. If the tool call fails, say so explicitly; do not claim success.
2. **Dedupe is a gate, not a suggestion.** No candidate is proposed for creation until Linear open-issue search AND `gh pr` search have been run and recorded. A hit short-circuits creation to `L` (link) or `pr-open`.
3. **Auto-fix real bugs.** When the dedupe gate is clean AND false-defect verification is clean AND the candidate isn't on the handoff-exclusion list (see § Handoff conditions), after Linear creation the skill invokes `red-green-fix` via the `Skill` tool — without waiting for an extra human prompt.

### What the skill cannot do

The Slack MCP exposes no `reactions.add` tool, so the skill cannot put a `:white_check_mark:` reaction on the parent message. The thread reply with the leading `:white_check_mark:` emoji is the skill's canonical marker; a human can additionally add the parent reaction for channel visibility (see § Parent reaction — optional visibility nudge). Both are respected by Processed Detection.

## Team emoji scheme

| Emoji                | Meaning            | Who adds it                                            | Skill behavior                                 |
| -------------------- | ------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| `:white_check_mark:` | Ticket created     | Human on parent (after skill files); also in bot reply | Skip in future sweeps                          |
| `:pr-open:`          | PR open            | Human                                                  | Skip creation; include PR link in approval row |
| `:question:`         | Needs more context | Human                                                  | Skip creation; agent may ask for clarification |
| `:repeat:`           | Duplicate          | Human                                                  | Skip creation; link existing Linear issue      |

## Design Priority

Optimize for **coverage, label quality, and proven fixes** over fix-path cleverness. Linear is the downstream triage surface — once every bug is there with status, labels, and context, agents and humans can work from Linear alone. A Linear ticket with a wrong severity is cheap to fix; a Slack-only bug is invisible to downstream tooling; a "filed but not fixed" real regression wastes a human turn that the skill could have spent on a red-green PR.

## Quick Start

1. **Scope** — default window: messages in the last 48h. Override with `--since YYYY-MM-DD` or a Slack permalink list.
2. **Fetch** — `slack_read_channel` for `C0A4XMHANP3`; `slack_read_thread` per message with replies.
3. **Filter** — drop already-processed (see Processed Detection).
4. **Classify** — bug / discussion / meta (see Classification Rules).
5. **Pre-flight dedupe gate (MANDATORY)** — for every bug candidate, run Linear open-issue search AND `gh pr` search BEFORE proposing (see § Pre-flight Dedupe Gate). A hit means the candidate goes into the batch as `L` (link) or `pr-open`, not as a new create.
6. **Verify false defects** — per candidate, run quick checks before proposing (see False-Defect Verification).
7. **Extract** — normalize to ticket schema (see Ticket Schema).
8. **Human approval** — batch table, collect Y/N/?/S/L/R per candidate (see Interactive Approval). Default recommendation for clean candidates is `Y` (file + auto-fix).
9. **Create Linear** — one issue per approved candidate; attach Slack permalink.
10. **Thread reply (ingested marker) — MANDATORY TOOL CALL** — call `mcp__plugin_slack_slack__slack_send_message` with `channel_id=C0A4XMHANP3`, `thread_ts=<parent-ts>`, text starting with `:white_check_mark: Filed to Linear: <URL>`. Do not substitute this with chat output. Record the returned `ts` in the session log.
11. **Auto-fix (clean candidates only)** — if dedupe gate is clean AND false-defect verification is clean AND the candidate isn't on the Handoff-Exclusion list, immediately invoke the `red-green-fix` skill via the `Skill` tool. See § Fix Workflow for the exact call contract.
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

```text
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

## Pre-flight Dedupe Gate (MANDATORY)

Before any candidate enters the approval table, run BOTH checks below and record the result in the row's `Dedup` and `PR` columns. This is a hard gate — no candidate may be proposed for creation without a verdict.

### Check 1 — Open Linear issues

Extract 3-5 keyword terms from the proposed title (strip stopwords). Query Linear via MCP:

```text
mcp__linear__list_issues({
  query: "<keyword-1> <keyword-2>",
  team: "Frontend Engineering",
  includeArchived: false,
  state: ["Triage", "Backlog", "Todo", "In Progress", "In Review"]
})
```

Run the query twice if needed with different keyword subsets to catch reworded titles. Treat a hit as a duplicate if any of:

- Title overlap ≥ 80% (after lowercasing + stopword removal)
- Same reporter + same component reference in description
- Same stack trace or error code

**Verdict:** set `Dedup: LIN-NNN` and default recommendation to `L` (link, don't create). The human may still override to `Y` to file a separate ticket.

### Check 2 — Open or merged fix PRs on GitHub

```bash
# Open PRs matching title keywords
gh pr list --repo Comfy-Org/ComfyUI_frontend --state open \
  --search "<keyword-1> <keyword-2>" --limit 5 \
  --json number,title,url,createdAt

# Recent merged fixes (last 30d) — catches "already fixed, waiting to ship"
gh pr list --repo Comfy-Org/ComfyUI_frontend --state merged \
  --search "<keyword-1> <keyword-2> merged:>=<YYYY-MM-DD>" --limit 5 \
  --json number,title,url,mergedAt
```

Treat a hit as a match if the PR title/body mentions the same component or bug phrase and the PR is unmerged or merged within the window covering the reporter's observation.

**Verdict:**

- Open PR match → set `PR: #NNNN (open)`, recommendation `pr-open` (file Linear with `pr-open` label linking the PR, skip auto-fix).
- Merged PR match → set `PR: #NNNN (merged)`, recommendation `fixed` (demote in verify, usually skip; human can override if the reporter claims the fix didn't land).

### Failure handling

If either check errors (MCP down, `gh` auth expired), DO NOT proceed to proposal — stop the sweep, report the failure to the user, and let them decide whether to re-run or manually dedupe. A silent skip of dedupe is never acceptable; it's the single biggest source of duplicate tickets.

Log each dedupe query + top hits in `~/temp/bug-dump-ingest/session-YYYY-MM-DD.md` under a per-candidate `Dedup trace:` block so the human can audit.

## Interactive Approval

Present candidates in batches of 5-10. Table format (10 columns):

```text
 #  | Slack (author, time)   | Proposed title                          | Env        | Sev  | Area       | Dedup      | PR            | Verify      | Rec
----+------------------------+-----------------------------------------+------------+------+------------+------------+---------------+-------------+-----
 1  | wavey, 04-20 08:06     | Unet dropdown missing selected model    | cloud prod | low  | ui         | -          | -             | resolved    | N
 2  | Denys, 04-18 05:45     | Pro plan jobs end at 30 minutes         | cloud prod | high | cloud      | -          | -             | clean       | Y
 3  | Terry Jia, 04-18 12:52 | Nodes 2.0 canvas lag on large workflows | -          | high | node-system| LIN-4521   | -             | clean       | L
 4  | Pablo, 04-17 08:52     | Multi-asset delete popup shows hashes   | cloud prod | low  | ui         | -          | #11402 (open) | clean       | pr-open
```

Each row MUST show: Slack author + date, proposed title, env tags, severity, area, **dedupe status from the Pre-flight Dedupe Gate**, **open/merged PR hit from the Pre-flight Dedupe Gate**, verify tag (from False-Defect Verification), and agent recommendation.

### Default recommendation logic

The skill computes `Rec` deterministically from the gate results:

- `L` — Dedupe hit on open Linear issue.
- `pr-open` — Open GitHub PR hit.
- `fixed` — Merged PR hit within the reporter's observation window.
- `N` — Verify tag is `resolved`, `expected`, `stale`, or `env` only.
- `?` — Repro incomplete or classification ambiguous.
- `Y` — Everything clean AND candidate is not on the § Handoff-Exclusion list. This is the "file + auto-fix" path.
- `Y (file-only)` — Clean but on the handoff-exclusion list (e.g. touches LGraphNode, needs backend). File Linear, skip auto-fix.

### Response format

- `Y` — default path: create Linear ticket, post `:white_check_mark:` thread reply, AND if the candidate is eligible (dedupe clean, verify clean, not on handoff-exclusion list), immediately invoke `red-green-fix` via the `Skill` tool. See § Fix Workflow.
- `S` — **skip auto-fix** for this row: create Linear ticket + thread reply only, do NOT run red-green-fix. Use when the human knows a specific person is already investigating or wants to batch fixes.
- `N` — skip entirely (log reason in session file).
- `?` — mark as needs-context; skill posts a thread reply asking for repro details and prompts the human to add `:question:` to the parent.
- `L` — link to existing Linear issue instead of creating (skill asks which one if the Pre-flight Dedupe Gate didn't return an exact match).
- `R` — duplicate of another bug-dump message; skill links the two and prompts the human for `:repeat:` on the parent.
- `E` — edit proposed title/description before creating (skill shows draft for inline tweaks).
- Bulk responses accepted: `1 N, 2 Y, 3 L LIN-4521, 4 pr-open #11402, 5 ?` — any row omitted from the response is treated as its computed `Rec` default.

Do not create any Linear issues until all candidates in the batch have a terminal decision. Auto-fix invocations run sequentially AFTER all Linear creates complete, so every `red-green-fix` call has a `Fixes LIN-NNN` to put in the PR body.

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

## Slack Thread Reply (Ingested Marker) — MANDATORY TOOL CALL

After each successful Linear creation, the skill MUST call `mcp__plugin_slack_slack__slack_send_message` to post a threaded reply on the original message. This is a tool call, not a chat output. The skill is not done with the candidate until this call succeeds.

### Required call shape

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-message-ts>",   // dotted form, e.g. "1776714531.990509"
  text: ":white_check_mark: Filed to Linear: <LINEAR_URL>\nReporter: <@USER_ID>\nSev: <severity>  •  Area: <area>"
})
```

Rules:

- `thread_ts` MUST be the parent message ts — never the channel ts, never omitted. An omitted `thread_ts` posts at channel level, which pollutes `#bug-dump` and breaks Processed Detection.
- The text MUST start with `:white_check_mark:` followed by a space and `Filed to Linear:`. This exact prefix is what future sweeps grep for via `has::white_check_mark: from:me`.
- The Linear URL MUST be present. No URL = not ingested; future sweeps will re-file the same bug.
- Plain text only — no markdown tables, no bold, no code fences. Slack renders the emoji shortcode into a real `:white_check_mark:` only when the message is plain text.
- Capture the returned `ts` and record it in the session log for audit.

### NEVER-do list (common failure mode)

- **Do NOT** print `:white_check_mark: Filed to Linear: <URL>` into the Claude CLI chat response as a substitute for calling `slack_send_message`. The CLI output is not seen by Slack. If you find yourself typing the marker into a plain assistant message, stop and issue the tool call instead.
- **Do NOT** claim the thread reply was posted until the `slack_send_message` tool call has returned a success with a `ts`. If the tool call errors, surface the error and halt the batch — do not fabricate a reply.
- **Do NOT** use any other tool (e.g. `slack_schedule_message`, `slack_send_message_draft`) as a substitute. Only an immediate `slack_send_message` with `thread_ts` set counts as the ingested marker.

### Fix-path reply (after red-green-fix opens a PR)

When `red-green-fix` returns a PR URL for an auto-fixed candidate, the skill MUST post a second thread reply on the same parent — again via `slack_send_message`:

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<same parent ts>",
  text: ":pr-open: Fix PR: <PR_URL>\nRed-green verified: <unit|e2e> test proves the regression.\nFixes <LIN-ID>"
})
```

Same "tool call, not chat output" rule applies.

### Parent reaction — optional visibility nudge (not on critical path)

The Slack MCP does not expose `reactions.add`, so the skill cannot set a `:white_check_mark:` reaction on the parent. The thread reply above is sufficient for Processed Detection; the parent reaction is a human-only "visible in channel" nudge. At the end of the run, the skill MAY print a compact list for the human:

```text
Optional: add :white_check_mark: to parent messages for in-channel visibility.
  LIN-4710 → <permalink>
  LIN-4711 → <permalink>
```

This is a convenience, not a deliverable — a missing parent reaction does not cause re-ingestion.

## Fix Workflow (auto-invoke red-green-fix)

For every `Y` row whose `Rec` resolved to auto-fix (dedupe clean, verify clean, not on handoff-exclusion list), the skill MUST — after Linear creation and the `:white_check_mark:` thread reply — invoke the `red-green-fix` skill via the `Skill` tool. This is a real tool call, not a narrative handoff.

### Required Skill tool call

```text
Skill({
  skill: "red-green-fix",
  args: "<composed prompt — see below>"
})
```

Compose `args` as a single self-contained prompt so the sub-invocation has everything it needs without re-reading the Linear issue:

```text
Bug: <title>
Linear: <LIN-ID> (<LINEAR_URL>)
Source: Slack <permalink>
Reporter: <display-name>
Env: <env tags>
Area: <area>
Branch: fix/<lin-id-lowercase>-<short-slug>

Repro:
1. <step>
2. <step>

Expected: <expected behavior>
Actual: <actual behavior>

Test layer (inferred from area):
- ui → Vitest colocated + Playwright e2e tagged @regression
- node-system → Playwright e2e primarily
- workflow / templates → Playwright e2e
- cloud → Vitest if client-side; otherwise STOP and label the Linear issue "needs-backend"

Test naming:
- describe('<LIN-ID>: <one-line bug summary>', ...)
- Playwright test title must include the LIN-ID.

PR body must include:
- "Fixes <LIN-ID>"
- "Source: Slack <permalink>"

Follow the red-green-fix two-commit sequence exactly. Do NOT skip the red commit.
```

The skill MUST wait for `red-green-fix` to return before moving to the next candidate. Process one auto-fix at a time so branch state is deterministic.

### Verifying the invocation ran

After the `Skill` call returns, the skill MUST confirm at least one of:

1. A new git branch named `fix/<lin-id>-*` exists (`git branch --list "fix/<lin-id>-*"`).
2. A PR URL is present in `red-green-fix`'s return payload.

If neither is true, the invocation silently no-op'd. Log the failure to the session log as `auto-fix skipped: invocation returned without branch or PR` and continue — do NOT post the `:pr-open:` thread reply.

### Inputs summary

- **Bug description** — the Linear description (includes repro, env, source permalink).
- **Linear ID** — inserted into the PR body as `Fixes <LIN-ID>`.
- **Branch name** — `fix/<lin-id>-<short-slug>` (e.g. `fix/lin-4711-pro-plan-30min-timeout`).
- **Test layer** — inferred from `area`:
  - `ui` → unit (Vitest) + e2e (Playwright)
  - `node-system` → e2e primarily; unit if isolable
  - `workflow` / `templates` → e2e
  - `cloud` → unit if client-side logic, otherwise flag "backend — out of scope for this repo"

### Handoff-Exclusion list (do NOT auto-invoke red-green-fix)

These rows still get a Linear ticket + `:white_check_mark:` thread reply, but the skill MUST skip the `Skill(skill="red-green-fix")` call and instead post a thread nudge explaining why:

- Repro steps are incomplete (no clear numbered steps, no env) — reply in thread: "Need clearer repro before I can write a failing test. What's the shortest path to reproduce?"
- Fix requires backend / ComfyUI repo changes (not frontend) — label Linear `needs-backend`.
- Linear ticket was dedupe-linked rather than newly created — existing owner may already be fixing.
- Severity is cosmetic AND reporter hasn't asked for a fix — file ticket only.
- Fix would touch `LGraphNode`, `LGraphCanvas`, `LGraph`, or `Subgraph` god-objects (ADR-0003/0008 — always human decision).
- Pre-flight Dedupe Gate found an open PR (`pr-open`) or a matching merged PR (`fixed`).

When a row is excluded, record the reason in the session log under `auto-fix excluded: <reason>`.

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

(The Handoff-Exclusion list above governs when `red-green-fix` is NOT invoked.)

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

```text
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

```text
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

- `red-green-fix` — auto-invoked via the `Skill` tool for every eligible `Y` candidate to produce a failing test + fix + PR with the red-green CI proof.
- `writing-playwright-tests` — used by red-green-fix when an e2e test is needed.
- `hardening-flaky-e2e-tests` — if the e2e test added in the fix PR starts flaking, jump to this skill.
