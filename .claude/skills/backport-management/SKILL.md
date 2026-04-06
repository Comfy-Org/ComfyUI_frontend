---
name: backport-management
description: Manages cherry-pick backports across stable release branches. Discovers candidates from Slack/git, analyzes dependencies, resolves conflicts via worktree, and logs results. Use when asked to backport, cherry-pick to stable, manage release branches, do stable branch maintenance, or run a backport session.
---

# Backport Management

Cherry-pick backport management for Comfy-Org/ComfyUI_frontend stable release branches.

## Quick Start

1. **Discover** — Collect candidates from Slack bot + git log gap (`reference/discovery.md`)
2. **Analyze** — Categorize MUST/SHOULD/SKIP, check deps (`reference/analysis.md`)
3. **Human Review** — Present candidates in batches for interactive approval (see Interactive Approval Flow)
4. **Plan** — Order by dependency (leaf fixes first), group into waves per branch
5. **Execute** — Label-driven automation → worktree fallback for conflicts (`reference/execution.md`)
6. **Verify** — After each wave, verify branch integrity before proceeding
7. **Log & Report** — Generate session report (`reference/logging.md`)

## System Context

| Item           | Value                                                                       |
| -------------- | --------------------------------------------------------------------------- |
| Repo           | `~/ComfyUI_frontend` (Comfy-Org/ComfyUI_frontend)                           |
| Merge strategy | Auto-merge via workflow (`--auto --squash`); `--admin` only after CI passes |
| Automation     | `pr-backport.yaml` GitHub Action (label-driven, auto-merge enabled)         |
| Tracking dir   | `~/temp/backport-session/`                                                  |

## CI Safety Rules

**NEVER merge a backport PR without all CI checks passing.** This applies to both automation-created and manual cherry-pick PRs.

- **Automation PRs:** The `pr-backport.yaml` workflow now enables `gh pr merge --auto --squash`, so clean PRs auto-merge once CI passes. Monitor with polling (`gh pr list --base TARGET_BRANCH --state open`). Do not intervene unless CI fails.
- **Manual cherry-pick PRs:** After `gh pr create`, wait for CI before merging. Poll with `gh pr checks $PR --watch` or use a sleep+check loop. Only merge after all checks pass.
- **CI failures:** DO NOT use `--admin` to bypass failing CI. Analyze the failure, present it to the user with possible causes (test backported without implementation, missing dependency, flaky test), and let the user decide the next step.

## Branch Scope Rules

**Critical: Match PRs to the correct target branches.**

| Branch prefix | Scope                          | Example                                   |
| ------------- | ------------------------------ | ----------------------------------------- |
| `cloud/*`     | Cloud-hosted ComfyUI only      | Team workspaces, cloud queue, cloud-only login |
| `core/*`      | Local/self-hosted ComfyUI only | Core editor, local workflows, node system |
| Both          | Shared infrastructure          | App mode, Firebase auth (API nodes), payment URLs |

### What Goes Where

**Both core + cloud:**
- **App mode** PRs — app mode is NOT cloud-only
- **Firebase auth** PRs — Firebase auth is on core for API nodes
- **Payment redirect** PRs — payment infrastructure shared
- **Bug fixes** touching shared components

**Cloud-only (skip for core):**
- Team workspaces
- Cloud queue virtualization
- Hide API key login
- Cloud-specific UI behind cloud feature flags

**⚠️ NEVER backport cloud-only PRs to `core/*` branches.** But do NOT assume "app mode" or "Firebase" = cloud-only. Check the actual files changed.

## ⚠️ Gotchas (Learn from Past Sessions)

### Use `gh api` for Labels — NOT `gh pr edit`

`gh pr edit --add-label` triggers Projects Classic deprecation errors. Always use:

```bash
gh api repos/Comfy-Org/ComfyUI_frontend/issues/$PR/labels \
  -f "labels[]=needs-backport" -f "labels[]=TARGET_BRANCH"
```

### Automation Over-Reports Conflicts

The `pr-backport.yaml` action reports more conflicts than reality. `git cherry-pick -m 1` with git auto-merge handles many cases the automation can't. Always attempt manual cherry-pick before skipping.

### Never Skip Based on Conflict File Count

12 or 27 conflicting files can be trivial (snapshots, new files). **Categorize conflicts first**, then decide. See Conflict Triage below.

### Accept-Theirs Can Produce Broken Hybrids

When a PR **rewrites a component** (e.g., PrimeVue → Reka UI), the accept-theirs regex produces a broken mix of old and new code. The template may reference new APIs while the script still has old imports, or vice versa.

**Detection:** Content conflicts with 4+ conflict markers in a single `.vue` file, especially when imports change between component libraries.

**Fix:** Instead of accept-theirs regex, use `git show MERGE_SHA:path/to/file > path/to/file` to get the complete correct version from the merge commit on main. This bypasses the conflict entirely.

### Cherry-Picks Can Reference Missing Dependencies

When PR A on main depends on code introduced by PR B (which was merged before A), cherry-picking A brings in code that references B's additions. The cherry-pick succeeds but the branch is broken.

**Common pattern:** Composables, component files, or type definitions introduced by an earlier PR and used by the cherry-picked PR.

**Detection:** `pnpm typecheck` fails with "Cannot find module" or "is not defined" errors after cherry-pick.

**Fix:** Use `git show MERGE_SHA:path/to/missing/file > path/to/missing/file` to bring the missing files from main. Always verify with typecheck.

### Use `--no-verify` for Worktree Pushes

Husky hooks fail in worktrees (can't find lint-staged config). Always use `git push --no-verify` and `git commit --no-verify` when working in `/tmp/` worktrees.

### Automation Success Varies Wildly by Branch

In the 2026-04-06 session: core/1.42 got 18/26 auto-PRs, cloud/1.42 got only 1/25. The cloud branch has more divergence. **Always plan for manual fallback** — don't assume automation will handle most PRs.

## Conflict Triage

**Always categorize before deciding to skip. High conflict count ≠ hard conflicts.**

| Type                         | Symptom                              | Resolution                                                      |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| **Binary snapshots (PNGs)**  | `.png` files in conflict list        | `git checkout --theirs $FILE && git add $FILE` — always trivial |
| **Modify/delete (new file)** | PR introduces files not on target    | `git add $FILE` — keep the new file                             |
| **Modify/delete (removed)**  | Target removed files the PR modifies | `git rm $FILE` — file no longer relevant                        |
| **Content conflicts**        | Marker-based (`<<<<<<<`)             | Accept theirs via python regex (see below)                      |
| **Component rewrites**       | 4+ markers in `.vue`, library change | Use `git show SHA:path > path` — do NOT accept-theirs           |
| **Import-only conflicts**    | Only import lines differ             | Keep both imports if both used; remove unused after              |
| **Add/add**                  | Both sides added same file           | Accept theirs, verify no logic conflict                         |
| **Locale/JSON files**        | i18n key additions                   | Accept theirs, validate JSON after                              |

```python
# Accept theirs for content conflicts
import re
pattern = r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n?'
content = re.sub(pattern, r'\2', content, flags=re.DOTALL)
```

### Escalation Triggers (Flag for Human)

- **Package.json/lockfile changes** → skip on stable (transitive dep regression risk)
- **Core type definition changes** → requires human judgment
- **Business logic conflicts** (not just imports/exports) → requires domain knowledge
- **Admin-merged conflict resolutions** → get human review of the resolution before continuing the wave

## Auto-Skip Categories

Skip these without discussion:

- **Dep refresh PRs** — Risk of transitive dep regressions on stable. Cherry-pick individual CVE fixes instead.
- **CI/tooling changes** — Not user-facing
- **Test-only / lint rule changes** — Not user-facing
- **Revert pairs** — If PR A reverted by PR B, skip both. If fixed version (PR C) exists, backport only C.
- **Features not on target branch** — e.g., Painter, GLSLShader, appModeStore on core/1.40
- **Cloud-only PRs on core/\* branches** — Team workspaces, cloud queue, cloud-only login. (Note: app mode and Firebase auth are NOT cloud-only — see Branch Scope Rules)

## Wave Verification

After merging each wave of PRs to a target branch, verify branch integrity before proceeding:

```bash
# Fetch latest state of target branch
git fetch origin TARGET_BRANCH

# Quick smoke check: does the branch build?
git worktree add /tmp/verify-TARGET origin/TARGET_BRANCH
cd /tmp/verify-TARGET
source ~/.nvm/nvm.sh && nvm use 24 && pnpm install && pnpm typecheck && pnpm test:unit
git worktree remove /tmp/verify-TARGET --force
```

If typecheck or tests fail, stop and investigate before continuing. A broken branch after wave N means all subsequent waves will compound the problem.

### Fix PRs Are Normal

Expect to create 1 fix PR per branch after verification. Common issues:

1. **Component rewrite hybrids** — accept-theirs produced broken `.vue` files. Fix: overwrite with correct version from merge commit via `git show SHA:path > path`
2. **Missing dependency files** — cherry-pick brought in code referencing composables/components not on the branch. Fix: add missing files from merge commit
3. **Missing type properties** — cherry-picked code uses interface properties not yet on the branch (e.g., `key` on `ConfirmDialogOptions`). Fix: add the property to the interface
4. **Unused imports** — conflict resolution kept imports that the branch doesn't use. Fix: remove unused imports
5. **Wrong types from conflict resolution** — e.g., `{ top: number; right: number }` vs `{ top: number; left: number }`. Fix: match the return type of the actual function

Create a fix PR on a branch from the target, verify typecheck passes, then merge with `--squash --admin`.

### Never Admin-Merge Without CI

In a previous bulk session, all 69 backport PRs were merged with `gh pr merge --squash --admin`, bypassing required CI checks. This shipped 3 test failures to a release branch. **Lesson: `--admin` skips all branch protection, including required status checks.** Only use `--admin` after confirming CI has passed (e.g., `gh pr checks $PR` shows all green), or rely on auto-merge (`--auto --squash`) which waits for CI by design.

## Continuous Backporting Recommendation

Large backport sessions (50+ PRs) are expensive and error-prone. Prefer continuous backporting:

- Backport bug fixes as they merge to main (same day or next day)
- Use the automation labels immediately after merge
- Reserve session-style bulk backporting for catching up after gaps
- When a release branch is created, immediately start the continuous process

## Interactive Approval Flow

After analysis, present ALL candidates (MUST, SHOULD, and borderline) to the human for interactive review before execution. Do not write a static decisions.md — collect approvals in conversation.

### Batch Presentation

Present PRs in batches of 5-10, grouped by theme (visual bugs, interaction bugs, cloud/auth, data correctness, etc.). Use this table format:

```
 #  | PR     | Title                                    | Target        | Rec  | Context
----+--------+------------------------------------------+---------------+------+--------
 1  | #12345 | fix: broken thing                        | core+cloud/42 | Y    | Description here. Why it matters. Agent reasoning.
 2  | #12346 | fix: another issue                       | core/42       | N    | Only affects removed feature. Not on target branch.
```

Each row includes:
- PR number and title
- Target branches
- Agent recommendation: `Rec: Y` or `Rec: N` with brief reasoning
- 2-3 sentence context: what the PR does, why it matters (or doesn't)

### Human Response Format

- `Y` — approve for backport
- `N` — skip
- `?` — investigate (agent shows PR description, files changed, detailed take, then re-asks)
- Any freeform question or comment triggers discussion before moving on
- Bulk responses accepted (e.g. `1 Y, 2 Y, 3 N, 4 ?`)

### Rules

- ALL candidates are reviewed, not just MUST items
- When human responds `?`, show the PR description, files changed, and agent's detailed analysis, then re-ask for their decision
- When human asks a question about a PR, answer with context and recommendation, then wait for their decision
- Do not proceed to execution until all batches are reviewed and every candidate has a Y or N

## Quick Reference

### Label-Driven Automation (default path)

```bash
gh api repos/Comfy-Org/ComfyUI_frontend/issues/$PR/labels \
  -f "labels[]=needs-backport" -f "labels[]=TARGET_BRANCH"
# Wait 3 min, check: gh pr list --base TARGET_BRANCH --state open
```

### Manual Worktree Cherry-Pick (conflict fallback)

```bash
git worktree add /tmp/backport-$BRANCH origin/$BRANCH
cd /tmp/backport-$BRANCH

# For each PR:
git fetch origin $BRANCH
git checkout -b backport-$PR-to-$BRANCH origin/$BRANCH
git cherry-pick -m 1 $MERGE_SHA
# Resolve conflicts (see Conflict Triage)
git push origin backport-$PR-to-$BRANCH --no-verify
gh pr create --base $BRANCH --head backport-$PR-to-$BRANCH \
  --title "[backport $BRANCH] $TITLE (#$PR)" \
  --body "Backport of #$PR. [conflict notes]"
gh pr merge $NEW_PR --squash --admin
sleep 25
```

### Efficient Batch: Test-Then-Resolve Pattern

When many PRs need manual cherry-pick (e.g., cloud branches), test all first:

```bash
cd /tmp/backport-$BRANCH
for pr in "${ORDER[@]}"; do
  git checkout -b test-$pr origin/$BRANCH
  if git cherry-pick -m 1 $SHA 2>/dev/null; then
    echo "CLEAN: $pr"
  else
    echo "CONFLICT: $pr"
    git cherry-pick --abort
  fi
  git checkout --detach HEAD
  git branch -D test-$pr
done
```

Then process clean PRs in a batch loop, conflicts individually.

### PR Title Convention

```
[backport TARGET_BRANCH] Original Title (#ORIGINAL_PR)
```

## Final Deliverables (Slack-Compatible)

After execution completes, generate two files in `~/temp/backport-session/`. Both must be **Slack-compatible plain text** — no emojis, no markdown tables, no headers (`#`), no bold (`**`), no inline code. Use plain dashes, indentation, and line breaks only.

### 1. Author Accountability Report

File: `backport-author-accountability.md`

Lists all backported PRs grouped by original author (via `gh pr view $PR --json author`). Surfaces who should be self-labeling.

```
Backport Session YYYY-MM-DD -- PRs that should have been labeled by authors

- author-login
    - #1234 fix: short title
    - #5678 fix: another title
- other-author
    - #9012 fix: some other fix
```

Authors sorted alphabetically, 4-space indent for nested items.

### 2. Slack Status Update

File: `slack-status-update.md`

A shareable summary of the session. Structure:

```
Backport session complete -- YYYY-MM-DD

[1-sentence summary: N PRs backported to which branches. All pass typecheck.]

Branches updated:
- core/X.XX: N PRs + N fix PRs (N auto, N manual)
- cloud/X.XX: N PRs + N fix PRs (N auto, N manual)
- ...

N total PRs created and merged (N backports + N fix PRs).

Notable fixes included:
- [category]: [list of fixes]
- ...

Conflict patterns encountered:
- [pattern and how it was resolved]
- ...

N authors had PRs backported. See author accountability list for details.
```

No emojis, no tables, no bold, no headers. Plain text that pastes cleanly into Slack.
