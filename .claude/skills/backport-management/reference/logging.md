# Logging & Session Reports

## During Execution

Maintain `execution-log.md` with per-branch tables (this is internal, markdown tables are fine here):

```markdown
| PR#   | Title | Status  | Backport PR | Notes   |
| ----- | ----- | ------- | ----------- | ------- |
| #XXXX | Title | merged  | #YYYY       | Details |
```

## Wave Verification Log

Track verification results per wave within execution-log.md:

```markdown
Wave N Verification -- TARGET_BRANCH

- PRs merged: #A, #B, #C
- Typecheck: pass / fail
- Fix PR: #YYYY (if needed)
- Issues found: (if any)
```

## Session Report Template

```markdown
# Backport Session Report

## Summary

| Branch | Candidates | Merged | Skipped | Deferred | Rate |
| ------ | ---------- | ------ | ------- | -------- | ---- |

## Deferred Items (Needs Human)

| PR# | Title | Branch | Issue |

## Conflict Resolutions Requiring Review

| PR# | Branch | Conflict Type | Resolution Summary |

## CI Failure Report

| PR# | Branch | Failing Check | Error Summary | Cause | Resolution |
| --- | ------ | ------------- | ------------- | ----- | ---------- |

## Automation Performance

| Metric                      | Value |
| --------------------------- | ----- |
| Auto success rate           | X%    |
| Manual resolution rate      | X%    |
| Overall clean rate          | X%    |
| Wave verification pass rate | X%    |

## Process Recommendations

- Were there clusters of related PRs that should have been backported together?
- Any PRs that should have been backported sooner (continuous backporting candidates)?
- Feature branches that need tracking for future sessions?
```

## Final Deliverables

After all branches are complete and verified, generate these files in `~/temp/backport-session/`:

### 1. execution-log.md (internal)

Per-branch tables with PR#, title, status, backport PR#, notes. Markdown tables are fine — this is for internal tracking, not Slack.

### 2. backport-author-accountability.md (Slack-compatible)

See SKILL.md "Final Deliverables" section. Plain text, no emojis/tables/headers/bold. Authors sorted alphabetically with PRs nested under each.

### 3. slack-status-update.md (Slack-compatible)

See SKILL.md "Final Deliverables" section. Plain text summary that pastes cleanly into Slack. Includes branch counts, notable fixes, conflict patterns, author count.

## Slack Formatting Rules

Both shareable files (author accountability + status update) must follow these rules:

- No emojis (no checkmarks, no arrows, no icons)
- No markdown tables (use plain lists with dashes)
- No headers (no # or ##)
- No bold (**) or italic (*)
- No inline code backticks
- Use -- instead of em dash
- Use plain dashes (-) for lists with 4-space indent for nesting
- Line breaks between sections for readability

These files should paste directly into a Slack message and look clean.

## Files to Track

All in `~/temp/backport-session/`:

- `execution-plan.md` -- approved PRs with merge SHAs (input)
- `execution-log.md` -- real-time status with per-branch tables (internal)
- `backport-author-accountability.md` -- PRs grouped by author (Slack-compatible)
- `slack-status-update.md` -- session summary (Slack-compatible)
