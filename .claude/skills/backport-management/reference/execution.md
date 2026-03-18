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

# Check which got auto-PRs
gh pr list --base TARGET_BRANCH --state open --limit 50 --json number,title
```

## Step 2: Review & Merge Clean Auto-PRs

```bash
for pr in $AUTO_PRS; do
  # Check size
  gh pr view $pr --json title,additions,deletions,changedFiles \
    --jq '"Files: \(.changedFiles), +\(.additions)/-\(.deletions)"'
  # Admin merge
  gh pr merge $pr --squash --admin
  sleep 3
done
```

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
  # Categorize conflicts first: binary PNGs, modify/delete, content, add/add
  # See SKILL.md Conflict Triage table for resolution per type.

  # Resolve all conflicts, then:
  git add .
  GIT_EDITOR=true git cherry-pick --continue

  git push origin backport-$PR-to-TARGET
  NEW_PR=$(gh pr create --base TARGET_BRANCH --head backport-$PR-to-TARGET \
    --title "[backport TARGET] TITLE (#$PR)" \
    --body "Backport of #$PR..." | grep -oP '\d+$')
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
source ~/.nvm/nvm.sh && nvm use 24 && pnpm install && pnpm typecheck
git worktree remove /tmp/verify-TARGET --force
```

If verification fails, stop and fix before proceeding to the next wave. Do not compound problems across waves.

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

### 4. Locale Files

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
gh pr merge $PR --squash --admin
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
10. **Verify after each wave** — run `pnpm typecheck` on the target branch after merging a batch. Catching breakage early prevents compounding errors.
11. **Cloud-only PRs don't belong on core/\* branches** — app mode, cloud auth, and cloud-specific UI changes are irrelevant to local users. Always check PR scope against branch scope before backporting.
