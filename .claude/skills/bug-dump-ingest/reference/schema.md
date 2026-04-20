# Ticket Schema — Extraction Notes

Field-by-field guidance for normalizing a Slack #bug-dump message into a ticket.

## `slack_ts`

The top-level message timestamp from `slack_read_channel` response (`Message TS:` field). Always store the dotted form (`1776510375.473579`). This is the ingestion identity used in `processed.json`.

## `slack_permalink`

Construct:

```
https://comfy-organization.slack.com/archives/C0A4XMHANP3/p<ts-without-dot>
```

Example: `1776510375.473579` → `.../p1776510375473579`.

## `reporter`

The display name + parenthetical nickname if present. Examples from the channel:

- `Ali Ranjah (wavey)`
- `Denys Puziak`
- `Christian Byrne`

Do NOT use the Slack user ID (`U087MJCDHHC`) in Linear — names are more readable.

## `title`

Rules:

- Start with a verb or noun phrase describing the observed defect, not the reporter.
- ≤ 80 chars.
- Include env qualifier ("cloud prod", "local dev", "electron") only if ambiguous.
- Strip emoji and reactions from the original message when extracting.

Transformations:

| Slack message (excerpt)                                                 | Title                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| "unet model dropdown doesnt display all available models..."            | Unet dropdown missing selected model                |
| "Dates are broken on Settings -> Secrets. Cloud Prod"                   | Settings → Secrets dates broken on cloud prod       |
| "LTX-2: Audio to VIdeo template results in the "RuntimeError..." error" | LTX-2 Audio-to-Video template RuntimeError on cloud |

## `description`

Structure — see `linear-api.md` Description Template. Key rules:

- Lead with **Repro** numbered list. Extract from the message body; if no steps are given, write "Repro: [Slack message body quoted verbatim]" and flag for human in approval.
- Preserve the reporter's own words in the Repro section when they include "step 1 / step 2" markers.
- Collapse multi-paragraph asides into "Notes" at the end.

## `env`

Detect from message text using these terms:

| Text in message            | Tag                    |
| -------------------------- | ---------------------- |
| `cloud prod`, `prod cloud` | `cloud prod`           |
| `cloud dev`                | `cloud dev`            |
| `cloud`                    | `cloud` (unqual.)      |
| `local`, `localhost`       | `local`                |
| `electron`, `desktop`      | `electron`             |
| `nodes 2.0`, `LG`          | (feature tag, not env) |

A message can have multiple env tags. If none are detectable, set `env: []` and flag "env unclear" in the approval row.

## `severity`

Heuristics in SKILL.md. When uncertain, mark `medium` and note in approval table: `Sev: medium (flag)`.

## `area`

Single tag. Use the one that best fits; tiebreak toward the more actionable team:

- `cloud` > `workflow` when the reported behavior is specific to cloud-hosted features (billing, queue, jobs)
- `node-system` > `ui` when the defect is canvas interaction, not just visual
- `templates` only when a named template is the subject

## `attachments`

From `slack_read_channel` message `Files:` field. Parse name, ID, type. Never include the Slack file ID in the Linear description — those are permissioned — just the filename and type.

## `thread_resolution`

Fetch via `slack_read_thread`. Scan replies for:

- `solved`, `resolved`, `fixed`, `no action needed` → `solved`
- A `:done:` reaction from the reporter → `solved`
- A `https://github.com/Comfy-Org/ComfyUI_frontend/pull/` URL in a reply → `pr-open` (keep but note in description)
- Otherwise → `open`

If `solved` and no PR merged, flag in approval table: reporter marked solved — confirm before filing.
