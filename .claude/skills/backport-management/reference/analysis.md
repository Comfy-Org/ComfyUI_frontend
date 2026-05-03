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

| Target branch | Skip if PR is...                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `core/*`      | Cloud-only (team workspaces, cloud queue, cloud-only login). Note: app mode and Firebase auth are NOT cloud-only. |
| `cloud/*`     | Local-only features not present on cloud branch                                                                   |

Cloud-only PRs backported to `core/*` are wasted effort — `core/*` branches serve local/self-hosted users who never see cloud features. Check PR titles, descriptions, and files changed for cloud-specific indicators.

## Features Not on Stable Branches

Check before backporting — these don't exist on older branches:

- **Painter** (`src/extensions/core/painter.ts`) — not on core/1.40
- **GLSLShader** — not on core/1.40
- **App builder** — check per branch
- **appModeStore.ts** — not on core/1.40

### Verify Target File Existence (Run Before Cherry-Pick)

Before cherry-picking any PR, confirm the files it modifies actually exist on the target branch. If they don't, the PR's runtime fix is for a feature that hasn't been added yet — skip cleanly without attempting cherry-pick:

```bash
# For each file the PR changes
for f in $(gh pr view $PR --json files --jq '.files[].path' | grep -v "^browser_tests/\|\.test\." ); do
  if ! git cat-file -e origin/$TARGET:$f 2>/dev/null; then
    echo "MISSING on $TARGET: $f"
  fi
done
```

If the *primary* changed files (the runtime ones, not tests) are missing, mark the PR `SKIP / feature-not-on-branch`. This is faster than letting cherry-pick fail with modify/delete conflicts and gives a clean signal.

This check is the first thing that runs after the path pre-filter and BEFORE you spend time reading PR descriptions.

## Tiered Triage (Recommended for 30+ Candidates)

Before the interactive Y/N approval flow, bucket all surviving candidates into three tiers. This surfaces release-engineering decisions that a flat MUST/SHOULD list obscures:

### Tier 1 — Core Editor Must-Haves

User-facing bugs, crashes, data corruption, or security issues in code paths that exist on the target branch. These are the strongest backport candidates.

Indicators:
- `fix:` prefix and the bug is reproducible on the target branch
- Crash guards, runtime null checks, race-condition fixes
- Data-loss bugs (state not persisted, duplicates, drops)
- Security hardening (CSRF, XSS, auth)
- Vue Nodes 2.0 regression cluster (if the target ships Vue Nodes 2.0)
- Subgraph correctness fixes
- Public-API extension callback fixes

Recommend `Y` to user.

### Tier 2 — Cloud-Distribution Only

Bugs that only manifest on cloud-hosted distributions (Secrets panel, subscription flows, cloud signup, workspace tracking, etc.). Whether to backport depends on whether cloud ships from the target `core/*` branch in your release matrix.

Indicators:
- Files under `src/platform/secrets/`, `src/platform/subscription/`, signup flows
- PR description mentions cloud staging issues
- Fix gated behind cloud feature flags

Default: ask the cloud release rotation owner. If unsure, defer.

### Tier 3 — Skip

Path pre-filter caught most of these. The rest are PRs where the diff *touches* `src/` but the practical impact is non-user-facing or scoped to features the target doesn't ship.

Indicators:
- All changes in test files even if the PR touched `src/` test files
- Storybook stories only
- Lint config / lint rule additions
- Documentation comments
- Internal refactors with no behavior change

### Presentation Format

When showing tier results to the user, format as:

```text
Tier 1 (N PRs) — strong backport candidates
- #11541 fix: stop duplicate node creation when dropping image on Vue nodes
  Why: Vue Nodes 2.0 regression — async onDragDrop bypassed handled-check, drops bubble to document, spawns extra LoadImage nodes
- #10849 fix: store promoted widget values per SubgraphNode instance
  Why: Multiple instances overwriting each other's promoted widget values — data loss

Tier 2 (N PRs) — cloud-distribution release rotation should decide
- #11636 fix: enable Chrome password autofill on signup form
- ...

Tier 3 (N PRs) — skip recommended
- #11586 fix: website polish (apps/website/ only)
- ...
```

Then run interactive Y/N over Tier 1 and Tier 2; Tier 3 gets confirmed-skip without per-PR review.

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

Use the Interactive Approval Flow (see SKILL.md) to review all candidates interactively. Do not write a static decisions.md for the human to edit — instead, present batches of 5-10 PRs with context and recommendations, and collect Y/N/? responses in conversation.

All candidates must be reviewed (MUST, SHOULD, and borderline items), not just a subset.
