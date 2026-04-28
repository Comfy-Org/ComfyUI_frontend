---
name: bug-dump-ingest
description: 'Syncs the #bug-dump Slack channel into Linear as the system of record AND auto-fixes verified real bugs via red-green-fix. Every Linear operation (create, search, link, label) is performed by posting an @Linear mention in the bug-dump thread — no Linear MCP, no API key. Flow: fetch → mandatory dedupe gate (@Linear search + gh PR search) → false-defect verification → post @Linear create in thread (tool call) → parse bot card for FE-NNNN + URL → post :white_check_mark: confirmation reply → if candidate is a verified real bug with no dedupe hit and no open PR, invoke red-green-fix automatically to produce failing test + fix + PR. Respects team emoji scheme (:white_check_mark: ticket created, :pr-open: PR open, :question: needs context, :repeat: duplicate). Use when asked to sync #bug-dump to Linear, triage slack bugs, run a bug-dump sweep, or ingest bug reports. Triggers on: bug-dump, sync bug-dump, ingest bugs, triage slack bugs, bug sweep.'
---

# Bug Dump Ingest

**Primary job: sync `#bug-dump` (Slack: `C0A4XMHANP3`) into Linear as the source of truth, then auto-fix the verified real bugs.** Linear is where status, labels, and follow-up triage happen — this skill gets every bug into Linear with enough context that a downstream agent or human can work from Linear alone. **Every Linear action is performed by mentioning `@Linear` in the bug-dump thread**; there is no Linear MCP and no API key path. When pre-flight verification confirms a candidate is a real bug (not dedupe, not already in a PR, not out of scope), the skill then invokes `red-green-fix` automatically.

```text
fetch → pre-flight dedupe gate (@Linear search + gh) → verify false defects → present approvals
      → POST "@Linear create ..." thread reply via slack_send_message  (mandatory tool call)
      → poll slack_read_thread → parse Linear bot card for FE-NNNN + URL
      → POST :white_check_mark: confirmation thread reply via slack_send_message
      → if verification = "real bug" AND no dedupe AND no open PR:
          invoke Skill(skill="red-green-fix") → POST :pr-open: thread reply
```

### Non-negotiable rules

1. **Linear actions are Slack tool calls.** The skill MUST drive Linear by calling `mcp__plugin_slack_slack__slack_send_message` with `thread_ts` set and text that mentions `@Linear`. There is no MCP-direct path and no API-key path. Printing `@Linear create ...` into the Claude CLI response is NOT a substitute — the Slack thread reply is what triggers the Linear bot, and its card is the canonical receipt.
2. **Dedupe is a gate, not a suggestion.** No candidate is proposed for creation until `@Linear search` AND `gh pr` search have been run and recorded. A hit short-circuits creation to `L` (link) or `pr-open`.
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
5. **Pre-flight dedupe gate (MANDATORY)** — for every bug candidate, run `@Linear search` AND `gh pr` search BEFORE proposing (see § Pre-flight Dedupe Gate). A hit means the candidate goes into the batch as `L` (link) or `pr-open`, not as a new create.
6. **Verify false defects** — per candidate, run quick checks before proposing (see False-Defect Verification).
7. **Extract** — normalize to ticket schema (see Ticket Schema).
8. **Human approval** — batch table, collect Y/N/?/S/L/R per candidate (see Interactive Approval). Default recommendation for clean candidates is `Y` (file + auto-fix).
9. **Post `@Linear create` thread reply — MANDATORY TOOL CALL** — for each approved `Y`/`L` row, call `mcp__plugin_slack_slack__slack_send_message` with `channel_id=C0A4XMHANP3`, `thread_ts=<parent-ts>`, and text starting with `@Linear create` (see § Linear Slack Bot Integration). Do NOT print the command into chat as a substitute.
10. **Capture the Linear bot card** — poll `slack_read_thread` up to 3× with ~3s spacing, parse the first Linear-app reply for the `FE-NNNN` identifier and `https://linear.app/...` URL. No URL = not ingested; never fabricate one.
11. **Post `:white_check_mark:` confirmation reply — MANDATORY TOOL CALL** — call `slack_send_message` again with text starting with `:white_check_mark: Filed to Linear: <URL>` so future sweeps can detect the marker via `has::white_check_mark: from:me`. Record both `ts` values in the session log.
12. **Auto-fix (clean candidates only)** — if dedupe gate is clean AND false-defect verification is clean AND the candidate isn't on the Handoff-Exclusion list, immediately invoke the `red-green-fix` skill via the `Skill` tool. See § Fix Workflow for the exact call contract.
13. **Log** — append to session log; update `processed.json`.

## System Context

| Item               | Value                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Source channel     | `#bug-dump` (`C0A4XMHANP3`)                                                                                                |
| Destination        | Linear `Frontend Engineering` team, via the Linear Slack app (`@Linear`). Team is named in every `@Linear create` message. |
| Default state      | `Triage` — every `@Linear create` message includes `Status: Triage`                                                        |
| State dir          | `~/temp/bug-dump-ingest/`                                                                                                  |
| Processed registry | `~/temp/bug-dump-ingest/processed.json`                                                                                    |
| Session log        | `~/temp/bug-dump-ingest/session-YYYY-MM-DD.md`                                                                             |
| Drafts (failure)   | `~/temp/bug-dump-ingest/drafts/*.md` — written only when `@Linear` never replies, so the human can retry manually          |

## Label Taxonomy

Every created Linear issue MUST get the following labels, passed as a comma-separated list in the `Labels:` line of the `@Linear create` message. The Linear Slack app creates missing labels on first use:

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

### Check 1 — Open Linear issues (via `@Linear search`)

Extract 3-5 keyword terms from the proposed title (strip stopwords). Post a search command to the bug-dump thread — use a scratch thread if no parent `ts` is available yet, but prefer the candidate's own parent thread so the search card becomes part of that thread's audit trail:

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear search <keyword-1> <keyword-2>\nTeam: Frontend Engineering\nStatus: open"
})
```

Poll `slack_read_thread` for up to 10s; parse the Linear app's card reply for `FE-NNNN` identifiers and URLs. Run the search twice with different keyword subsets if the first returns zero hits — reworded titles are the top false-negative class.

If `@Linear search` is not supported by the workspace's Linear app version, fall back to a Slack search for prior `@Linear` card replies in the channel:

```text
mcp__plugin_slack_slack__slack_search_public({
  query: "in:<#C0A4XMHANP3> from:@Linear <keyword-1> <keyword-2>"
})
```

This scans past Linear bot replies in the channel — any reply containing a matching `FE-NNNN` URL is a candidate duplicate. Record which dedupe path was used in the session log.

Treat a hit as a duplicate if any of:

- Title overlap ≥ 80% (after lowercasing + stopword removal)
- Same reporter + same component reference in description
- Same stack trace or error code

**Verdict:** set `Dedup: FE-NNNN` and default recommendation to `L` (link, don't create). The human may still override to `Y` to file a separate ticket.

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

If either check errors (Linear Slack app silent or not in channel, `gh` auth expired), DO NOT proceed to proposal — stop the sweep, report the failure to the user, and let them decide whether to re-run or manually dedupe. A silent skip of dedupe is never acceptable; it's the single biggest source of duplicate tickets.

Log each dedupe query + top hits in `~/temp/bug-dump-ingest/session-YYYY-MM-DD.md` under a per-candidate `Dedup trace:` block so the human can audit.

## Interactive Approval

Present candidates in batches of 5-10. Table format (10 columns):

```text
 #  | Slack (author, time)   | Proposed title                          | Env        | Sev  | Area       | Dedup      | PR            | Verify      | Rec
----+------------------------+-----------------------------------------+------------+------+------------+------------+---------------+-------------+-----
 1  | wavey, 04-20 08:06     | Unet dropdown missing selected model    | cloud prod | low  | ui         | -          | -             | resolved    | N
 2  | Denys, 04-18 05:45     | Pro plan jobs end at 30 minutes         | cloud prod | high | cloud      | -          | -             | clean       | Y
 3  | Terry Jia, 04-18 12:52 | Nodes 2.0 canvas lag on large workflows | -          | high | node-system| FE-4521    | -             | clean       | L
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
- Bulk responses accepted: `1 N, 2 Y, 3 L FE-4521, 4 pr-open #11402, 5 ?` — any row omitted from the response is treated as its computed `Rec` default.

Do not post any `@Linear create` messages until all candidates in the batch have a terminal decision. Auto-fix invocations run sequentially AFTER every `@Linear create` has produced a parsed `FE-NNNN`, so every `red-green-fix` call has a `Fixes FE-NNNN` to put in the PR body.

## Linear Slack Bot Integration (@Linear)

Every Linear action — create, search, link, label, status change — is performed by posting a message to the candidate's thread in `#bug-dump` that mentions `@Linear`. The Linear Slack app parses the mention and responds with a card in the same thread. There is no Linear MCP path and no `LINEAR_API_KEY` path; see `reference/linear-api.md` § "Why no direct API path" for the rationale.

### Prerequisites

- The Comfy Slack workspace already has the Linear Slack app installed (this is how humans add `@Linear` mentions today).
- Channel `C0A4XMHANP3` is connected to the `Frontend Engineering` Linear team.
- No per-machine setup. If a `@Linear` invocation produces no bot reply, the app is not in the channel — surface to the human, do NOT retry silently.

### Create an issue

For each approved `Y` candidate, call:

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear create\nTeam: Frontend Engineering\nTitle: <title>\nStatus: Triage\nLabels: source:bug-dump, area:<area>, env:<env>, sev:<severity>, reporter:<handle>\n\n<description>\n\nSource: <slack-permalink>"
})
```

Rules:

- First line MUST be `@Linear create` — this is the command token.
- `Team: Frontend Engineering` is required on every create — without it the bot falls back to the workspace default, which may route to a different team.
- `Status: Triage` pins the initial state (per § System Context).
- `Labels:` — comma-separated, full `source:bug-dump, area:*, env:*, sev:*, reporter:*` set per § Label Taxonomy. Missing labels are auto-created by the Linear Slack app on first use.
- Description body is markdown — see `reference/linear-api.md` § "Description body template" and `reference/schema.md` for per-field extraction.
- Use real newlines (not literal `\n`) when constructing the text.

After the tool call returns, poll `slack_read_thread` for the Linear app's reply card (up to 3× with ~3s spacing). Parse the card for:

- An `FE-NNNN` identifier
- A `https://linear.app/<org>/issue/FE-NNNN` URL

The URL is the ingested receipt. The skill then posts the `:white_check_mark:` confirmation reply (§ Slack Thread Reply).

### Search (dedupe)

See § Pre-flight Dedupe Gate § Check 1 for the search command shape and handling of the bot's reply. The search is a tool call in the candidate's thread — not a chat aside.

### Link an existing issue (`L` response)

When the human picks `L FE-4521` for a row, do NOT post `@Linear create`. Instead:

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear link FE-4521"
})
```

The bot replies with the linked issue card. Then post the `:white_check_mark:` confirmation reply (adjusted to say `Linked to Linear:` rather than `Filed to Linear:`) so Processed Detection still matches.

### Label / status updates

When a later sweep needs to flip a ticket (e.g. a PR opened after initial ingest, so add `pr-open` and link):

```text
mcp__plugin_slack_slack__slack_send_message({
  channel_id: "C0A4XMHANP3",
  thread_ts: "<parent-ts>",
  text: "@Linear FE-4521 add-labels pr-open"
})
```

Status changes are rarely driven by this skill directly — Linear auto-moves issues to `In Review` when a PR with `Fixes FE-NNNN` is opened, and the `red-green-fix` skill handles that PR body.

### Captured fields per create

Every successful create must produce, via the Linear bot's reply card:

- `identifier` — e.g. `FE-4710`, used in `Fixes <LIN-ID>` references and session log
- `url` — `https://linear.app/.../issue/FE-4710`, included verbatim in the `:white_check_mark:` reply
- `ts` of the Linear bot's card reply — recorded in session log for audit

If the card is missing the URL or identifier, fall through to the failure path below — do NOT fabricate either value.

### Failure path

If the Linear bot does not reply within the poll window, OR replies with a parse error (`couldn't parse`, `no team matched`, `failed`):

1. Write a draft markdown file to `~/temp/bug-dump-ingest/drafts/NN-short-slug.md` containing the full `@Linear create` text that was sent plus any partial bot reply.
2. Post a thread reply that is explicit about the failure — do NOT include `:white_check_mark:` or a fake Linear URL:
   ```text
   :warning: bug-dump-ingest: @Linear did not respond. Drafted at ~/temp/bug-dump-ingest/drafts/<slug>.md — please file manually and reply with the FE-NNNN.
   ```
3. Skip auto-fix for this candidate (no Linear ID = no `Fixes` reference).
4. Log the failure in the session log.

Never invent a Linear URL. Never post `:white_check_mark: Filed to Linear: ...` without a real URL parsed from a real Linear bot card.

## Slack Thread Reply (Ingested Marker) — MANDATORY TOOL CALL

Every approved candidate produces **two** mandatory `slack_send_message` calls in the parent thread:

1. The `@Linear create` (or `@Linear link`) command — see § Linear Slack Bot Integration.
2. The `:white_check_mark:` confirmation reply described below, posted after a real `FE-NNNN` + URL have been parsed from the Linear bot's card.

The second reply is what future sweeps grep for via `has::white_check_mark: from:me`. Even though the Linear bot's own card already contains the URL, the `:white_check_mark:` prefix is the canonical Processed Detection marker — without it, a future sweep may re-ingest the same bug.

The skill is not done with a candidate until BOTH calls have succeeded. If either fails, do not claim the candidate is ingested.

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

- **Do NOT** print `@Linear create ...` or `:white_check_mark: Filed to Linear: <URL>` into the Claude CLI chat response as a substitute for calling `slack_send_message`. The CLI output is not seen by Slack. If you find yourself typing either into a plain assistant message, stop and issue the tool call instead.
- **Do NOT** claim the thread reply was posted until the `slack_send_message` tool call has returned a success with a `ts`. If the tool call errors, surface the error and halt the batch — do not fabricate a reply.
- **Do NOT** use any other tool (e.g. `slack_schedule_message`, `slack_send_message_draft`) as a substitute. Only an immediate `slack_send_message` with `thread_ts` set counts — the Linear Slack app does not trigger on scheduled/draft messages.
- **Do NOT** substitute any direct Linear API call (MCP, GraphQL, curl) for the `@Linear` mention. The Slack thread is intentionally the single audit trail.

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

- `reference/linear-api.md` — `@Linear` Slack bot command reference (create, search, link, labels, status).
- `reference/schema.md` — full ticket schema with field-by-field extraction notes.
- `reference/examples.md` — worked examples drawn from real #bug-dump messages.
- `reference/verify-commands.md` — cookbook of false-defect verification commands per bug class.

## Related Skills

- `red-green-fix` — auto-invoked via the `Skill` tool for every eligible `Y` candidate to produce a failing test + fix + PR with the red-green CI proof.
- `writing-playwright-tests` — used by red-green-fix when an e2e test is needed.
- `hardening-flaky-e2e-tests` — if the e2e test added in the fix PR starts flaking, jump to this skill.
