---
name: comment-sicko
description: 'Dispatches the comment-sicko subagent to hunt gratuitous comments in a PR/diff, triages its raw findings, and posts a polite, professional writeup. Use when reviewing a PR/diff, checking for unnecessary/gratuitous comments, or asked to run "the angry comment review" / "comment-sicko". Modeled on Cursor''s no-comments skill (github.com/cursor/plugins, pstack/skills/no-comments).'
---

# Comment Sicko

Dispatcher for the `comment-sicko` subagent (`.claude/agents/comment-sicko.md`), a deliberately savage comment-hater with zero softening and doubt-resolves-to-delete. The subagent's job is to find kills without mercy; **this skill's job is to triage those kills into something a human can actually read** — verify, don't just relay.

**Agent guardrail, not a CI gate** — never blocks a merge or fails a check, no opt-out label. The team rejected a CI-check-plus-label mechanism: a label becomes a reflexive "comments-ok" click. Runs only when invoked during review or on request.

## Process

1. **Spawn.** Dispatch the `comment-sicko` subagent via `Task` on the PR/branch diff. It returns raw, savage, unfiltered verdicts (`file:line` + comment + KILL/KEEP/MUST KILL) — do not show these to a human as-is.
2. **Triage every returned KILL/MUST KILL:**
   - **Reject** any verdict that escapes scope (comments the diff didn't touch) or misstates what the code does — the subagent doesn't re-read context, you do.
   - **Verify** each surviving KILL is genuinely trivial before it goes out; don't take "doubt is meat" at face value if the comment turns out to explain a real outside-our-control constraint.
   - **Keep** the subagent's own-code-workaround and lint-suppression `MUST KILL` mandates (the named symbol/rename) — those are the parts upstream calls the "meat," and they're worth preserving verbatim in substance.
3. **Act on what survives triage, depending on what you're reviewing:**
   - **Someone else's PR / a diff you didn't write:** never silently edit their code. Rewrite each surviving finding into polite, professional, PR-postable text — no insults, no leftover savage phrasing — and post it as a review comment: inline per-line where the repo's review-comment conventions support it (see `comprehensive-pr-review`'s inline-comment approach), or one consolidated comment listing `file:line` + quoted comment + verdict if inline isn't available.
   - **Your own pending changes:** delete the surviving KILLs directly and report what you removed, in plain professional language. Skip the Mea culpa ritual — that's for catching yourself, not reviewing someone else's line.
4. **Tally.** Report counts (kept, killed, rejected-on-triage) so the reader can see the subagent wasn't rubber-stamped.

## Output shape

```
[comment-sicko] src/components/NodeBadge.vue:42
  // increment the counter by one
  count.value++
Delete it — the comment restates the next line.
```

## Integration

When run as part of `comprehensive-pr-review` (`.claude/commands/comprehensive-pr-review.md`), add this dispatcher's triaged findings as one more review dimension — reuse that command's checkout/diffing/comment-posting mechanics rather than duplicating them.
