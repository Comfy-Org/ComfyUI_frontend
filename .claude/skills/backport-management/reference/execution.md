# Execution Workflow

## How backport PRs merge

`pr-backport.yaml` opens a backport PR for each target label. `pr-assign-release-sheriff.yaml` assigns the release sheriff and requests their review. `backport-auto-merge.yaml` squash-merges the PR once it is approved and its required checks pass. Branch protection on `core/**` and `cloud/**` requires both and cannot be bypassed, so never try `gh pr merge --admin`. Manual cherry-pick PRs follow the same path when their title uses the `[backport TARGET] Title (#PR)` convention.

## Per-Branch Execution Order

1. Smallest gap first (validation run)
2. Medium gap next (quick win)
3. Largest gap last (main effort)

## Worktree setup

Git hooks run `lint-staged`, `knip` and other repository tools, so a worktree needs its own dependencies before you commit or push from it:

```bash
git fetch origin TARGET_BRANCH
git worktree add /tmp/backport-TARGET origin/TARGET_BRANCH
cd /tmp/backport-TARGET
pnpm install --frozen-lockfile
```

If a hook fails, fix what it reports. Never bypass hooks.

## Step 0: Test-Then-Resolve Pre-Pass (Recommended)

Before triggering label-driven automation, run a dry-run cherry-pick loop to classify candidates. This is much faster than discovering conflicts after the fact. The dry run commits nothing, so it needs no `pnpm install`.

```bash
git fetch origin TARGET_BRANCH
git worktree add /tmp/dryrun-TARGET origin/TARGET_BRANCH
cd /tmp/dryrun-TARGET

CLEAN=()
CONFLICT=()
for pr in "${CANDIDATES[@]}"; do
  SHA=$(gh pr view $pr --json mergeCommit --jq '.mergeCommit.oid')
  git checkout -b dryrun-$pr origin/TARGET_BRANCH 2>/dev/null
  if git cherry-pick -m 1 $SHA 2>/dev/null; then
    CLEAN+=($pr)
  else
    CONFLICT+=($pr)
    git cherry-pick --abort
  fi
  git checkout --detach HEAD 2>/dev/null
  git branch -D dryrun-$pr 2>/dev/null
done

echo "CLEAN (${#CLEAN[@]}): ${CLEAN[*]}"
echo "CONFLICT (${#CONFLICT[@]}): ${CONFLICT[*]}"

cd -
git worktree remove /tmp/dryrun-TARGET --force
```

Use the result to:

- Send CLEAN PRs through label-driven automation (Step 1)
- Reserve manual worktree time (Step 3) for CONFLICT PRs only
- Surface PRs likely to need backport-only compat shims (CONFLICT files in `src/lib/litegraph/` or `src/scripts/app.ts`)

## Step 1: Label-Driven Automation (Batch)

```bash
for pr in $PR_LIST; do
  gh api repos/Comfy-Org/ComfyUI_frontend/issues/$pr/labels \
    -f "labels[]=needs-backport" -f "labels[]=TARGET_BRANCH" --silent
  sleep 2
done

sleep 180
gh pr list --base TARGET_BRANCH --state open --limit 50 --json number,title
```

## Step 2: Monitor CI on Automation PRs

Clean automation PRs merge once the sheriff approves and CI passes. Check the ones still open:

```bash
for pr in $(gh pr list --base TARGET_BRANCH --state open --limit 50 --json number --jq '.[].number'); do
  echo "PR #$pr"
  gh pr checks $pr --json name,state --jq '.[] | select(.state == "FAILURE") | "  FAILED: \(.name)"'
  gh pr view $pr --json reviewDecision --jq '"  review: \(.reviewDecision)"'
done
```

If CI fails, see "CI Failure Triage" below. If CI is green and the PR waits on review, ping the sheriff.

## Step 3: Manual Worktree for Conflicts

Set up the worktree as described in "Worktree setup", then for each conflicting PR:

```bash
git fetch origin TARGET_BRANCH
git checkout -b backport-$PR-to-TARGET origin/TARGET_BRANCH
git cherry-pick -m 1 $MERGE_SHA
```

Resolve conflicts by category (see the SKILL.md Conflict Triage table and "Conflict Resolution Patterns" below), then `git add` and `GIT_EDITOR=true git cherry-pick --continue`. Never skip a PR based on conflict file count alone.

**Public-API conflict review.** If the resolution touched `node.onXxx` callbacks, methods on `LGraphNode`, `LGraphCanvas`, `LGraph` or `Subgraph`, public exports from `src/lib/litegraph/`, or types published from `src/types/index.ts` (`litegraph-augmentation.d.ts` on older branches), get an independent review before pushing. If a public callback's contract changed, add a backport-only compatibility shim that preserves the old contract and document it in the commit body under `## Backport-only compatibility fix`.

**Per-PR validation**, scoped to the files the cherry-pick changed:

```bash
mapfile -t TEST_FILES < <(git diff --name-only --diff-filter=d HEAD~1 | grep -E '\.test\.ts$' || true)
[ ${#TEST_FILES[@]} -gt 0 ] && pnpm test:unit "${TEST_FILES[@]}"

mapfile -t CODE_FILES < <(git diff --name-only --diff-filter=d HEAD~1 | grep -E '\.(ts|vue)$' || true)
[ ${#CODE_FILES[@]} -gt 0 ] && pnpm exec eslint "${CODE_FILES[@]}" && pnpm exec oxfmt --check "${CODE_FILES[@]}"
```

`--diff-filter=d` drops files the cherry-pick deleted, which the commands cannot open. Guard each command against an empty file list: `pnpm test:unit` with no path runs the whole suite. The pre-push hook and CI cover the rest.

```bash
git push origin backport-$PR-to-TARGET
gh pr create --base TARGET_BRANCH --head backport-$PR-to-TARGET \
  --title "[backport TARGET] TITLE (#$PR)" \
  --body "..."
```

Use the PR body template below. For any resolution beyond the trivial cases (binary snapshots, modify/delete, locale key additions), show the resolution diff to the human before the PR is approved.

When done with the branch: `cd - && git worktree remove /tmp/backport-TARGET --force`.

## Step 4: Wave Verification

After a wave merges, confirm the target branch is still green before starting the next wave. CI runs on pushes to release branches, and `release-branch-ci-alert.yaml` posts lint, format or typecheck failures on `core/**` and `cloud/**` to the frontend releases Slack channel.

```bash
gh run list --branch TARGET_BRANCH --event push --limit 10
```

If a run fails, **do not skip**. Create a fix PR from the worktree:

```bash
git fetch origin TARGET_BRANCH
git checkout -b fix-backport-TARGET origin/TARGET_BRANCH
git show MERGE_SHA:path/to/Component.vue > path/to/Component.vue
git show MERGE_SHA:path/to/missing.ts > path/to/missing.ts
git add -A
git commit -m "fix: resolve backport typecheck issues on TARGET"
git push origin fix-backport-TARGET
gh pr create --base TARGET --head fix-backport-TARGET --title "fix: resolve backport typecheck issues on TARGET" --body "..."
```

Typical fixes: overwrite component-rewrite hybrids and add missing dependency files from the merge commit, add missing interface properties, and delete unused imports. Do not proceed to the next branch until the branch is green.

## Conflict Resolution Patterns

### 1. Content Conflicts (accept theirs)

```python
import re
pattern = r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n?'
content = re.sub(pattern, r'\2', content, flags=re.DOTALL)
```

### 2. Modify/Delete (two cases)

```bash
git add $FILE
git rm $FILE
```

Use `git add` when the PR introduces a file the target lacks and the file is a real prerequisite. Use `git rm` when the target removed the file, or when the file was added on main by an earlier PR that is not being backported (see "Cherry-Picked Tests Can Reference Files Added By Earlier Unbackported PRs" in SKILL.md).

### 3. Binary Files (snapshots)

```bash
git checkout --theirs $FILE && git add $FILE
```

### 4. Component Rewrites (do not accept theirs)

When a PR completely rewrites a component (for example a component-library migration), accept-theirs produces a broken hybrid with mismatched template and script sections. Take the complete file from the merge commit instead:

```bash
git show $MERGE_SHA:path/to/Component.vue > path/to/Component.vue
git add path/to/Component.vue
```

**Detection:** 4+ conflict markers in a single `.vue` file, imports changing between component libraries, template structure completely different on each side.

### 5. Missing Dependencies After Cherry-Pick

A cherry-pick can succeed but leave the branch broken because the PR references composables or components introduced by an earlier PR.

```bash
git show $MERGE_SHA:path/to/missing.ts > path/to/missing.ts
```

**Detection:** the pre-commit typecheck or CI fails with "Cannot find module" or "X is not defined" after a clean cherry-pick.

### 6. Locale Files

Usually new i18n keys. Accept theirs, then validate JSON:

```bash
python3 -c "import json; json.load(open('src/locales/en/main.json'))" && echo "Valid"
```

## Merge Conflicts After Other Merges

When several PRs target the same branch, later PRs may conflict with earlier merges:

```bash
git fetch origin TARGET_BRANCH
git rebase origin/TARGET_BRANCH
git push --force-with-lease origin backport-$PR-to-TARGET
```

Wait for CI to rerun; the PR merges once approved and green.

## Lessons Learned

1. **Automation reports more conflicts than reality.** `cherry-pick -m 1` with git auto-merge handles many conflicts the automation can't.
2. **Never skip based on conflict file count.** Categorize first: binary PNGs, modify/delete, content, add/add.
3. **Modify/delete goes both ways.** Keep files the PR introduces; drop files the target removed.
4. **Binary snapshot PNGs** are always `git checkout --theirs && git add`.
5. **Batch label additions need a 2s delay** between API calls to avoid rate limits.
6. **Merging many PRs rapidly** can make later PRs unmergeable until GitHub recomputes merge state.
7. **Check features exist on the target** before backporting; `git rm` files for features the branch doesn't ship.
8. **Always validate JSON** after resolving locale file conflicts.
9. **Skip dep refresh PRs** on stable branches. Cherry-pick individual CVE fixes instead.
10. **Verify after each wave** using branch CI, so breakage doesn't compound.
11. **App mode and Firebase auth are not cloud-only.** Only team workspaces, cloud queue and cloud-specific login are.
12. **Accept-theirs regex breaks component rewrites.** Take the whole file from the merge commit.
13. **Fix PRs are expected.** Plan for one per branch to resolve typecheck issues from conflict resolutions.
14. **Cloud branches diverge more** than core branches, so automation creates far fewer clean PRs there. Plan for manual fallback.
15. **Public-API conflict resolutions need independent review** before pushing; custom-node packages depend on those contracts.
16. **Cherry-picked tests can require unbackported test scaffolding.** Drop such files and document which PR introduced them.

## CI Failure Triage

When CI fails on a backport PR, present failures to the user using this template:

```markdown
### PR #XXXX — CI Failed

- **Failing check:** test / lint / typecheck
- **Error:** (summary of the failure message)
- **Likely cause:** test backported without implementation / missing dependency / flaky test / snapshot mismatch
- **Recommendation:** backport PR #YYYY first / skip this PR / rerun CI after fixing prerequisites
```

| Category                    | Example                                  | Resolution                                |
| --------------------------- | ---------------------------------------- | ----------------------------------------- |
| Test without implementation | Test references function not on branch   | Backport the implementation PR first      |
| Missing dependency          | Import from module not on branch         | Backport the dependency PR first, or skip |
| Snapshot mismatch           | Screenshot test differs                  | Usually safe — update snapshots on branch |
| Flaky test                  | Passes on retry                          | Re-run CI                                 |
| Type error                  | Interface changed on main but not branch | May need manual adaptation                |

**Never assume a failure is safe to skip.** Present all failures to the user with analysis.

## PR Body Template (Manual Cherry-Picks)

Reviewers read this before re-deriving conflict-resolution logic from the diff.

```markdown
Manual backport of #ORIG to `TARGET` for inclusion in `vX.Y.Z`.

Cherry-picked from upstream merge commit `SHORT_SHA`.

## Why

[1-2 sentences from the original PR's summary: what bug, what fix mechanism]

## Conflict resolution

- **`path/to/file`** — [what conflicted on this branch] → [resolution chosen + why]
- **`path/to/dropped-test.test.ts`** — added on main by unrelated PR #XXXX (not backported). Dropped from this backport; runtime fix intact.

## Backport-only compatibility fix (if applicable)

[What extension surface, what contract, what the shim preserves, why the upstream version would have regressed it]

## Validation

- `pnpm test:unit <targeted suites>`
- `pnpm exec eslint <changed files>`
- `pnpm exec oxfmt --check <changed files>`

[If manual e2e was skipped, explain why. State whether source is byte-identical to upstream and how long it has been on main.]

Original PR: #ORIG / Original commit: `FULL_SHA`
```

Every conflict you resolved by hand needs a one-liner in the conflict-resolution section.
