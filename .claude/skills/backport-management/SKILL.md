---
name: backport-management
description: Manages cherry-pick backports across stable release branches. Discovers candidates from Slack/git, analyzes dependencies, resolves conflicts via worktree, and logs results. Use when asked to backport, cherry-pick to stable, manage release branches, do stable branch maintenance, or run a backport session.
---

# Backport Management

Cherry-pick backport management for Comfy-Org/ComfyUI_frontend stable release branches.

## Quick Start

1. **Discover** — Collect candidates from Slack bot + git log gap (`reference/discovery.md`)
2. **Analyze** — Categorize MUST/SHOULD/SKIP, check deps (`reference/analysis.md`)
3. **Plan** — Order by dependency (leaf fixes first), group into waves per branch
4. **Execute** — Label-driven automation → worktree fallback for conflicts (`reference/execution.md`)
5. **Verify** — After each wave, verify branch integrity before proceeding
6. **Log & Report** — Generate session report with mermaid diagram (`reference/logging.md`)

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
| `cloud/*`     | Cloud-hosted ComfyUI only      | App mode, cloud auth, cloud-specific UI   |
| `core/*`      | Local/self-hosted ComfyUI only | Core editor, local workflows, node system |

**⚠️ NEVER backport cloud-only PRs to `core/*` branches.** Cloud-only changes (app mode, cloud auth, cloud billing UI, cloud-specific API calls) are irrelevant to local users and waste effort. Before backporting any PR to a `core/*` branch, check:

- Does the PR title/description mention "app mode", "cloud", or cloud-specific features?
- Does the PR only touch files like `appModeStore.ts`, cloud auth, or cloud-specific components?
- If yes → skip for `core/*` branches (may still apply to `cloud/*` branches)

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

## Conflict Triage

**Always categorize before deciding to skip. High conflict count ≠ hard conflicts.**

| Type                         | Symptom                              | Resolution                                                      |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| **Binary snapshots (PNGs)**  | `.png` files in conflict list        | `git checkout --theirs $FILE && git add $FILE` — always trivial |
| **Modify/delete (new file)** | PR introduces files not on target    | `git add $FILE` — keep the new file                             |
| **Modify/delete (removed)**  | Target removed files the PR modifies | `git rm $FILE` — file no longer relevant                        |
| **Content conflicts**        | Marker-based (`<<<<<<<`)             | Accept theirs via python regex (see below)                      |
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
- **Cloud-only PRs on core/\* branches** — App mode, cloud auth, cloud billing. These only affect cloud-hosted ComfyUI.

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

### Never Admin-Merge Without CI

In a previous bulk session, all 69 backport PRs were merged with `gh pr merge --squash --admin`, bypassing required CI checks. This shipped 3 test failures to a release branch. **Lesson: `--admin` skips all branch protection, including required status checks.** Only use `--admin` after confirming CI has passed (e.g., `gh pr checks $PR` shows all green), or rely on auto-merge (`--auto --squash`) which waits for CI by design.

## Continuous Backporting Recommendation

Large backport sessions (50+ PRs) are expensive and error-prone. Prefer continuous backporting:

- Backport bug fixes as they merge to main (same day or next day)
- Use the automation labels immediately after merge
- Reserve session-style bulk backporting for catching up after gaps
- When a release branch is created, immediately start the continuous process

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
git checkout -b backport-$PR-to-$BRANCH origin/$BRANCH
git cherry-pick -m 1 $MERGE_SHA
# Resolve conflicts, push, create PR, merge
```

### PR Title Convention

```
[backport TARGET_BRANCH] Original Title (#ORIGINAL_PR)
```
