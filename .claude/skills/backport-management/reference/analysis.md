# Analysis & Decision Framework

## Categorization

| Category             | Criteria                                                                                                  | Action                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **MUST**             | User-facing bug, crash, data corruption, security. Clear breakage that users will hit.                    | Backport (with deps if needed)                                             |
| **SHOULD**           | UX improvement, minor bug, small dep chain. No user-visible breakage if skipped, but improves experience. | Backport if clean cherry-pick; defer if conflict resolution is non-trivial |
| **SKIP**             | CI/tooling, test-only, lint rules, cosmetic, dep refresh                                                  | Skip with documented reason                                                |
| **NEEDS DISCUSSION** | Large dep chain, unclear risk/benefit, touches core types                                                 | Flag for human                                                             |

### MUST vs SHOULD Decision Guide

When unsure, ask: "If a user on this stable branch reports this issue, would we consider it a bug?"

- **Yes** → MUST. The fix addresses broken behavior.
- **No, but it's noticeably better** → SHOULD. The fix is a quality-of-life improvement.
- **No, and it's cosmetic or internal** → SKIP.

For SHOULD items with conflicts: if conflict resolution requires more than trivial accept-theirs patterns (content conflicts in business logic, not just imports), downgrade to SKIP or escalate to NEEDS DISCUSSION.

## Branch Scope Filtering

**Before categorizing, filter by branch scope:**

| Target branch | Skip if PR is...                                                    |
| ------------- | ------------------------------------------------------------------- |
| `core/*`      | Cloud-only (app mode, cloud auth, cloud billing, cloud-specific UI) |
| `cloud/*`     | Local-only features not present on cloud branch                     |

Cloud-only PRs backported to `core/*` are wasted effort — `core/*` branches serve local/self-hosted users who never see cloud features. Check PR titles, descriptions, and files changed for cloud-specific indicators.

## Features Not on Stable Branches

Check before backporting — these don't exist on older branches:

- **Painter** (`src/extensions/core/painter.ts`) — not on core/1.40
- **GLSLShader** — not on core/1.40
- **App builder** — check per branch
- **appModeStore.ts** — not on core/1.40

## Dep Refresh PRs

Always SKIP on stable branches. Risk of transitive dependency regressions outweighs audit cleanup benefit. If a specific CVE fix is needed, cherry-pick that individual fix instead.

## Revert Pairs

If PR A is reverted by PR B:

- Skip BOTH A and B
- If a fixed version exists (PR C), backport only C

## Dependency Analysis

```bash
# Find other PRs that touched the same files
gh pr view $PR --json files --jq '.files[].path' | while read f; do
  git log --oneline origin/TARGET..$MERGE_SHA -- "$f"
done
```

## Human Review Checkpoint

Present decisions.md before execution. Include:

1. All MUST/SHOULD/SKIP categorizations with rationale
2. Questions for human (feature existence, scope, deps)
3. Estimated effort per branch
