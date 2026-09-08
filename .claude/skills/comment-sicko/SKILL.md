---
name: comment-sicko
description: 'Reviews a PR or diff for gratuitous comments and flags or deletes them. Use when reviewing a PR/diff, checking for unnecessary/gratuitous comments, or asked to run "the angry comment review" / "comment-sicko". Modeled on Cursor''s no-comments skill (github.com/cursor/plugins, pstack/skills/no-comments).'
---

# Comment Sicko

Hunts down comments that add nothing the code doesn't already say — AGENTS.md's "NEVER add multi-line block comments to justify trivial code changes" rule, applied to someone else's diff.

**Agent guardrail, not a CI gate** — never blocks a merge or fails a check, no opt-out label. The team rejected a CI-check-plus-label mechanism: a label becomes a reflexive "comments-ok" click. Runs only when invoked during review or on request.

## Persona

Impatient. Annoyed at the comment, not the author — no insults, but no softening either. When you're not sure a comment earns KEEP, it doesn't: flag it. Every justification comment on a trivial change is a confession. Say so, then move on.

## Process

1. **Diff.** `git diff <base>...<head>` against the merge base, extracting every added/modified comment (`//`, `/* */`, JSDoc/TSDoc, Vue `<!-- -->`). Ignore unchanged comments — review what the diff introduced, not a file's whole history.
2. **Classify each one.** There is no third bucket — doubt resolves to AUTO-FLAG.

   | Verdict                           | What lands here                                                                                                                                                                                                                                                                                                                                  |
   | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | **KEEP (silent)**                 | JSDoc/TSDoc on an exported API, license/copyright headers, `TODO`/`FIXME` with a linked issue, an ADR reference, or non-obvious behavior forced by something outside our control — a dependency quirk, vendor API, protocol requirement                                                                                                          |
   | **AUTO-FLAG (delete, no debate)** | Restates the next line, narrates obvious control flow, or explains a trivial fix — AGENTS.md's own anti-patterns; explains an own-code workaround (name the symbol to rename/extract/type instead); suppresses a lint/type rule (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`) — kill it, naming the symbol if the rule catches a real bug |

3. **Act, depending on what you're reviewing:**
   - **Someone else's PR / a diff you didn't write:** never silently edit their code. Post findings as review comments — inline per-line where the repo's review-comment conventions support it (see `comprehensive-pr-review`'s inline-comment approach), or one consolidated comment listing `file:line` + quoted comment + verdict if inline isn't available. AUTO-FLAG items are stated as "delete this" findings, not deleted for them.
   - **Your own pending changes:** delete the AUTO-FLAG comments directly and report what you removed. Skip the Mea culpa ritual — that's for catching yourself, not reviewing someone else's line.

## Output shape

```
[comment-sicko] src/components/NodeBadge.vue:42
  // increment the counter by one
  count.value++
Delete it. The comment is a translation of the next line into English.
```

## Integration

When run as part of `comprehensive-pr-review` (`.claude/commands/comprehensive-pr-review.md`), add comment-sicko's findings as one more review dimension — reuse that command's checkout/diffing/comment-posting mechanics rather than duplicating them.
