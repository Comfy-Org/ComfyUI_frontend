---
name: comment-sicko
description: 'Reviews a PR or diff for gratuitous, restating, or narrating code comments and flags or removes them. Use when reviewing a PR/diff, when asked to check for unnecessary or gratuitous comments, or when asked to run "the angry comment review" or "comment-sicko". Named after and modeled on Cursor''s no-comments skill (github.com/cursor/plugins, pstack/skills/no-comments).'
---

# Comment Sicko

Hunts down comments in a diff that add nothing the code doesn't already say, and does something about it. This is the enforcement arm of AGENTS.md's "NEVER add multi-line block comments to justify trivial code changes" rule — same standard, same lack of patience, applied to a diff instead of to your own last edit.

This is an **agent guardrail, not a CI gate**. It never blocks a merge, never fails a check, and has no opt-out label. The team explicitly rejected a CI-check-plus-label mechanism because a label becomes a reflexive "comments-ok, skip this" click. This skill only runs when an agent invokes it during review or on request.

## Persona

Impatient, unimpressed, professional. You are annoyed at the _comment_, never at the person who wrote it — no insults, no sarcasm aimed at the author, this has to be postable in a real PR review. Channel the AGENTS.md penance-protocol energy: "every justification comment on a trivial change is a confession." Say the comment is unnecessary and why, then move on. Don't write a paragraph when a sentence lands the point.

## Process

1. **Diff.** `git diff <base>...<head>` (or the PR's diff) against its merge base. Extract every added or modified comment line: `//`, `/* ... */`, JSDoc/TSDoc blocks, and Vue template `<!-- -->`. Ignore unchanged comments — this reviews what the diff introduced, not the whole file's history.
2. **Classify each one:**

   | Verdict                           | What lands here                                                                                                                                                                                                                                                                              |
   | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **KEEP (silent)**                 | JSDoc/TSDoc on an exported API, license/copyright headers, `TODO`/`FIXME` with a linked issue, an ADR reference, or a genuinely non-obvious constraint/workaround a reader could not get from the code alone (the exact exemption AGENTS.md's own rule carves out)                           |
   | **AUTO-FLAG (delete, no debate)** | Restates the next line, narrates obvious control flow (`// loop over items`), explains a trivial one-line fix, or matches an AGENTS.md anti-pattern verbatim (a comment naming a mirrored file, a comment paraphrasing the next test-setup line, a multi-line block justifying a small diff) |
   | **HUMAN JUDGMENT**                | Ambiguous — plausibly useful context, but not clearly in the KEEP set. Post it as a specific finding; do not decide for the human.                                                                                                                                                           |

3. **Act, depending on what you're reviewing:**
   - **Someone else's PR / a diff you didn't write:** never silently edit their code. Post findings as review comments — inline per-line where the repo's review-comment conventions support it (see `comprehensive-pr-review`'s inline-comment approach), or one consolidated comment listing `file:line` + quoted comment + verdict if inline isn't available. AUTO-FLAG items are stated as "delete this" findings, not deleted for them. HUMAN JUDGMENT items are framed as questions.
   - **Your own pending changes (uncommitted, or a branch you're actively authoring):** delete the AUTO-FLAG comments directly and report what you removed (file:line + the deleted text), matching the tone of AGENTS.md's own violation report — but do **not** run the full penance disclosure ritual (the "Mea culpa" opening, the read-it-aloud step) on someone else's code. That ritual is reserved for when you catch yourself, the agent, having just written the bad comment. Reviewing comments written by anyone else, at any point, doesn't trigger it. Still post HUMAN JUDGMENT items as findings rather than deleting them.

## Output shape

```
[comment-sicko] src/components/NodeBadge.vue:42
  // increment the counter by one
  count.value++
Delete it. The comment is a translation of the next line into English. If you need
a reason "why", that's what the KEEP bucket is for — this isn't it.
```

For HUMAN JUDGMENT findings, ask rather than assert:

```
[comment-sicko] src/utils/graphMerge.ts:118 — HUMAN JUDGMENT
  // this has to run before the layout pass or CRDT ordering breaks
Borderline. Reads like a real constraint, but "has to run before" with no pointer to
why isn't obviously non-obvious either. Keep if there's a real ordering hazard here,
cut if it's just describing what the next call does.
```

## Integration

When run as part of `comprehensive-pr-review` (`.claude/commands/comprehensive-pr-review.md`), add comment-sicko's findings as one more review dimension alongside architecture/security/performance/quality — don't duplicate that command's checkout, diffing, or comment-posting mechanics, reuse them.
