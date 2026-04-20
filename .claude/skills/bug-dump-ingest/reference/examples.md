# Worked Examples

Real #bug-dump messages (2026-04-17 → 2026-04-20) normalized through the skill.

## Example 1 — Clean bug with repro

**Source message** (wavey, 2026-04-20 08:06):

> unet model dropdown doesnt display all available models, think this is part of a larger issue with model dropdowns..
>
> • open flux.2 klein 4b image edit template
> • open unet drop down --> notice selected model isnt present in the list, even though its selected
> • execute (to check if it flags the model as missing) --> notice it still runs
> No action needed, this is solved

**Thread resolution**: "No action needed, this is solved" — reporter resolved it in the same message.

**Classification**: bug, but `thread_resolution = solved`. Flag for human.

**Approval row**:

```
 1 | wavey, 04-20 08:06 | Unet dropdown missing selected model | cloud | low | ui | N | N (reporter marked solved)
```

Default recommendation: `N`. If human overrides to `Y`, file with a "Regression test" label so QA still tracks it.

---

## Example 2 — Clear high-severity cloud bug

**Source message** (Denys Puziak, 2026-04-18 05:45):

> I see two reports about jobs ending in 30 minutes while the user is on the Pro plan
> cc @Hunter
> https://discord.com/channels/.../1494078128971055145

**Classification**: bug, `env: [cloud prod]` (Pro plan = cloud), `severity: high` (paying users), `area: cloud`.

**Proposed title**: `Pro plan jobs end at 30 minutes`

**Description** (excerpt):

```markdown
**Reporter:** Denys Puziak
**Env:** cloud prod
**Severity (proposed):** high
**Area:** cloud

## Repro

1. User on Pro plan submits a job
2. Job ends at 30 minutes instead of the Pro plan limit

## Notes

- Two user reports aggregated by Denys
- cc'd @Hunter

## Source

Slack: <permalink>
Discord thread: https://discord.com/channels/.../1494078128971055145
```

---

## Example 3 — Not a bug (discussion)

**Source message** (Christian Byrne, 2026-04-19 19:00):

> @Glary-Bot okay option A is clearly superior and I feel embarrassed I didn't see that line myself...

**Classification**: discussion (design review chatter). Skip. Log reason in session file.

---

## Example 4 — Meta-action / PR planning

**Source message** (Christian Byrne, 2026-04-19 09:30):

> @Glary-Bot how about we make a PR to do:
> 1. Audit the rest of the codebase...
> 2. Create a helper in src/base...

**Classification**: discussion (PR-plan proposal). Skip.

---

## Example 5 — Performance regression

**Source message** (Terry Jia, 2026-04-18 12:52):

> With Nodes 2.0, large workflows (hundreds of nodes) make the canvas extremely laggy and unusable for actual work — switching tabs takes several seconds or more. Switching back to Litegraph, performance is significantly better.

**Classification**: bug, `area: node-system`, `severity: high`.

**Dedupe**: Run Linear search for `nodes 2.0 performance` and `canvas lag`. Likely matches exist — flag `Dedup? ?` and ask human which ticket to link to.

---

## Example 6 — Reporter says it's a question, not a report

**Source message** (Luke, 2026-04-17 08:27):

> Is NodeInfo supposed to show information or docs about the node? It just brings up the node sidebar

**Classification**: question → ambiguous. Read thread. If replies confirm "that's unexpected, should show docs", upgrade to bug. If "yes that's intended", skip.

Default recommendation in the approval batch: `?` (needs expansion).

---

## Example 7 — Bug with PR already in flight

**Source message** (Pablo, 2026-04-17 08:52):

> when deleting multiple assets on cloud -> the confirmation popup still has the assets hashes as names instead of the display name

**Reaction**: `pr-open (1)` — someone's opened a PR.

**Classification**: `already-filed` branch. Skip creation; in the session log, note "PR already open". If the human wants a tracking Linear ticket anyway, still fileable with a link to the PR.
