# Execution Workflow

## Per-Branch Execution Order

1. Smallest gap first (validation run)
2. Medium gap next (quick win)
3. Largest gap last (main effort)

## Step 1: Label-Driven Automation (Batch)

```bash
# Add labels to all candidates for a target branch
for pr in $PR_LIST; do
  gh api repos/Comfy-Org/ComfyUI_frontend/issues/$pr/labels \
    -f "labels[]=needs-backport" -f "labels[]=TARGET_BRANCH" --silent
  sleep 2
done

# Wait 3 minutes for automation
sleep 180

# Check which got auto-PRs (auto-merge is enabled, so clean ones will self-merge after CI)
gh pr list --base TARGET_BRANCH --state open --limit 50 --json number,title
```

> **Note:** The `pr-backport.yaml` workflow now enables `gh pr merge --auto --squash` on automation-created PRs. Clean PRs will auto-merge once CI passes — no manual merge needed for those.

## Step 2: Wait for CI & Merge Clean Auto-PRs

Most automation PRs will auto-merge once CI passes (via `--auto --squash` in the workflow). Monitor and handle failures:

```bash
# Wait for CI to complete (~45 minutes for full suite)
sleep 2700

# Check which PRs are still open (CI may have failed, or auto-merge succeeded)
STILL_OPEN_PRS=$(gh pr list --base TARGET_BRANCH --state open --limit 50 --json number --jq '.[].number')
RECENTLY_MERGED=$(gh pr list --base TARGET_BRANCH --state merged --limit 50 --json number,title,mergedAt)

# For PRs still open, check CI status
for pr in $STILL_OPEN_PRS; do
  CI_FAILED=$(gh pr checks $pr --json name,state --jq '[.[] | select(.state == "FAILURE")] | length')
  CI_PENDING=$(gh pr checks $pr --json name,state --jq '[.[] | select(.state == "PENDING" or .state == "QUEUED")] | length')
  if [ "$CI_FAILED" != "0" ]; then
    # CI failed — collect details for triage
    echo "PR #$pr — CI FAILED:"
    gh pr checks $pr --json name,state,link --jq '.[] | select(.state == "FAILURE") | "\(.name): \(.state)"'
  elif [ "$CI_PENDING" != "0" ]; then
    echo "PR #$pr — CI still running ($CI_PENDING checks pending)"
  else
    # All checks passed but didn't auto-merge (race condition or label issue)
    gh pr merge $pr --squash --admin
    sleep 3
  fi
done
```

**⚠️ If CI fails: DO NOT admin-merge to bypass.** See "CI Failure Triage" below.

## Step 3: Manual Worktree for Conflicts

```bash
git fetch origin TARGET_BRANCH
git worktree add /tmp/backport-TARGET origin/TARGET_BRANCH
cd /tmp/backport-TARGET

for PR in ${CONFLICT_PRS[@]}; do
  # Refresh target ref so each branch is based on current HEAD
  git fetch origin TARGET_BRANCH
  git checkout origin/TARGET_BRANCH

  git checkout -b backport-$PR-to-TARGET origin/TARGET_BRANCH
  git cherry-pick -m 1 $MERGE_SHA

  # If conflict — NEVER skip based on file count alone!
  # Categorize conflicts first: binary PNGs, modify/delete, content, add/add, component rewrites
  # See SKILL.md Conflict Triage table for resolution per type.

  # For component rewrites (4+ markers in a .vue file, library migration):
  # DO NOT use accept-theirs regex — it produces broken hybrids.
  # Instead, use the complete file from the merge commit:
  # git show $MERGE_SHA:path/to/file > path/to/file

  # For simple content conflicts, accept theirs:
  # python3 -c "import re; ..."

  # Resolve all conflicts, then:
  git add .
  GIT_EDITOR=true git cherry-pick --continue

  git push origin backport-$PR-to-TARGET --no-verify
  NEW_PR=$(gh pr create --base TARGET_BRANCH --head backport-$PR-to-TARGET \
    --title "[backport TARGET] TITLE (#$PR)" \
    --body "Backport of #$PR..." | grep -oP '\d+$')

  # Wait for CI before merging — NEVER admin-merge without CI passing
  echo "Waiting for CI on PR #$NEW_PR..."
  gh pr checks $NEW_PR --watch --fail-fast || {
    echo "⚠️ CI failed on PR #$NEW_PR — skipping merge, needs triage"
    continue
  }
  gh pr merge $NEW_PR --squash --admin
  sleep 3
done

# Cleanup
cd -
git worktree remove /tmp/backport-TARGET --force
```

**⚠️ Human review for conflict resolutions:** When admin-merging a PR where you manually resolved conflicts (especially content conflicts beyond trivial accept-theirs), pause and present the resolution diff to the human for review before merging. Trivial resolutions (binary snapshots, modify/delete, locale key additions) can proceed without review.

## Step 4: Wave Verification

After completing all PRs in a wave for a target branch:

```bash
git fetch origin TARGET_BRANCH
git worktree add /tmp/verify-TARGET origin/TARGET_BRANCH
cd /tmp/verify-TARGET
source ~/.nvm/nvm.sh && nvm use 24 && pnpm install && pnpm typecheck && pnpm test:unit
git worktree remove /tmp/verify-TARGET --force
```

If verification fails, **do not skip** — create a fix PR:

```bash
# Stay in the verify worktree
git checkout -b fix-backport-TARGET origin/TARGET_BRANCH

# Common fixes:
# 1. Component rewrite hybrids: overwrite with merge commit version
git show MERGE_SHA:path/to/Component.vue > path/to/Component.vue

# 2. Missing dependency files
git show MERGE_SHA:path/to/missing.ts > path/to/missing.ts

# 3. Missing type properties: edit the interface
# 4. Unused imports: delete the import lines

git add -A
git commit --no-verify -m "fix: resolve backport typecheck issues on TARGET"
git push origin fix-backport-TARGET --no-verify
gh pr create --base TARGET --head fix-backport-TARGET --title "fix: resolve backport typecheck issues on TARGET" --body "..."
gh pr merge $PR --squash --admin
```

Do not proceed to the next branch until typecheck passes.

## Conflict Resolution Patterns

### 1. Content Conflicts (accept theirs)

```python
import re
pattern = r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n?'
content = re.sub(pattern, r'\2', content, flags=re.DOTALL)
```

### 2. Modify/Delete (two cases!)

```bash
# Case A: PR introduces NEW files not on target → keep them
git add $FILE

# Case B: Target REMOVED files the PR modifies → drop them
git rm $FILE
```

### 3. Binary Files (snapshots)

```bash
git checkout --theirs $FILE && git add $FILE
```

### 4. Component Rewrites (DO NOT accept-theirs)

When a PR completely rewrites a component (e.g., PrimeVue → Reka UI), accept-theirs produces
a broken hybrid with mismatched template/script sections.

```bash
# Use the complete correct file from the merge commit instead:
git show $MERGE_SHA:src/components/input/MultiSelect.vue > src/components/input/MultiSelect.vue
git show $MERGE_SHA:src/components/input/SingleSelect.vue > src/components/input/SingleSelect.vue
git add src/components/input/MultiSelect.vue src/components/input/SingleSelect.vue
```

**Detection:** 4+ conflict markers in a single `.vue` file, imports changing between component
libraries (PrimeVue → Reka UI, etc.), template structure completely different on each side.

### 5. Missing Dependencies After Cherry-Pick

Cherry-picks can succeed but leave the branch broken because the PR's code on main
references composables/components introduced by an earlier PR.

```bash
# Add the missing file from the merge commit:
git show $MERGE_SHA:src/composables/queue/useJobDetailsHover.ts > src/composables/queue/useJobDetailsHover.ts
git show $MERGE_SHA:src/components/builder/BuilderSaveDialogContent.vue > src/components/builder/BuilderSaveDialogContent.vue
```

**Detection:** `pnpm typecheck` fails with "Cannot find module" or "X is not defined" after cherry-pick succeeds cleanly.

### 6. Locale Files

Usually adding new i18n keys — accept theirs, validate JSON:

```bash
python3 -c "import json; json.load(open('src/locales/en/main.json'))" && echo "Valid"
```

## Merge Conflicts After Other Merges

When merging multiple PRs to the same branch, later PRs may conflict with earlier merges:

```bash
git fetch origin TARGET_BRANCH
git rebase origin/TARGET_BRANCH
# Resolve new conflicts
git push --force origin backport-$PR-to-TARGET
sleep 20  # Wait for GitHub to recompute merge state
# Wait for CI after rebase before merging
gh pr checks $PR --watch --fail-fast && gh pr merge $PR --squash --admin
```

## Lessons Learned

1. **Automation reports more conflicts than reality** — `cherry-pick -m 1` with git auto-merge handles many "conflicts" the automation can't
2. **Never skip based on conflict file count** — 12 or 27 conflicts can be trivial (snapshots, new files). Categorize first: binary PNGs, modify/delete, content, add/add.
3. **Modify/delete goes BOTH ways** — if the PR introduces new files (not on target), `git add` them. If target deleted files the PR modifies, `git rm`.
4. **Binary snapshot PNGs** — always `git checkout --theirs && git add`. Never skip a PR just because it has many snapshot conflicts.
5. **Batch label additions need 2s delay** between API calls to avoid rate limits
6. **Merging 6+ PRs rapidly** can cause later PRs to become unmergeable — wait 20-30s for GitHub to recompute merge state
7. **appModeStore.ts, painter files, GLSLShader files** don't exist on core/1.40 — `git rm` these
8. **Always validate JSON** after resolving locale file conflicts
9. **Dep refresh PRs** — skip on stable branches. Risk of transitive dep regressions outweighs audit cleanup. Cherry-pick individual CVE fixes instead.
10. **Verify after each wave** — run `pnpm typecheck && pnpm test:unit` on the target branch after merging a batch. Catching breakage early prevents compounding errors.
11. **App mode and Firebase auth are NOT cloud-only** — they go to both core and cloud branches. Only team workspaces, cloud queue, and cloud-specific login are cloud-only.
12. **Never admin-merge without CI** — `--admin` bypasses all branch protections including required status checks. A bulk session of 69 admin-merges shipped 3 test failures. Always wait for CI to pass first, or use `--auto --squash` which waits by design.
13. **Accept-theirs regex breaks component rewrites** — when a PR migrates between component libraries (PrimeVue → Reka UI), the regex produces a broken hybrid. Use `git show SHA:path > path` to get the complete correct version instead.
14. **Cherry-picks can silently bring in missing-dependency code** — if PR A references a composable introduced by PR B, cherry-picking A succeeds but typecheck fails. Always run typecheck after each wave and add missing files from the merge commit.
15. **Fix PRs are expected** — plan for 1 fix PR per branch to resolve typecheck issues from conflict resolutions. This is normal, not a failure.
16. **Use `--no-verify` in worktrees** — husky hooks fail in `/tmp/` worktrees. Always push/commit with `--no-verify`.
17. **Automation success varies by branch** — core/1.42 got 18/26 auto-PRs (69%), cloud/1.42 got 1/25 (4%). Cloud branches diverge more. Plan for manual fallback.
18. **Test-then-resolve pattern** — for branches with low automation success, run a dry-run loop to classify clean vs conflict PRs before processing. This is much faster than resolving conflicts serially.

## CI Failure Triage

When CI fails on a backport PR, present failures to the user using this template:

```markdown
### PR #XXXX — CI Failed

- **Failing check:** test / lint / typecheck
- **Error:** (summary of the failure message)
- **Likely cause:** test backported without implementation / missing dependency / flaky test / snapshot mismatch
- **Recommendation:** backport PR #YYYY first / skip this PR / rerun CI after fixing prerequisites
```

Common failure categories:

| Category                    | Example                                  | Resolution                                |
| --------------------------- | ---------------------------------------- | ----------------------------------------- |
| Test without implementation | Test references function not on branch   | Backport the implementation PR first      |
| Missing dependency          | Import from module not on branch         | Backport the dependency PR first, or skip |
| Snapshot mismatch           | Screenshot test differs                  | Usually safe — update snapshots on branch |
| Flaky test                  | Passes on retry                          | Re-run CI, merge if green on retry        |
| Type error                  | Interface changed on main but not branch | May need manual adaptation                |

**Never assume a failure is safe to skip.** Present all failures to the user with analysis.
