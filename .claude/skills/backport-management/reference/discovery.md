# Discovery — Candidate Collection

**Run all sources, then reconcile.** No single source is authoritative:
- Slack bot may flag PRs that have already been backported (false positive)
- Git gap may include PRs that don't need backport (test-only, design-system, website)
- Bot can also miss PRs that landed without the right labels

## Source 1: Slack Backport-Checker Bot

Use `slackdump` skill to export `#frontend-releases` channel (C09K9TPU2G7):

```bash
slackdump export -o ~/slack-exports/frontend-releases.zip C09K9TPU2G7
```

Parse bot messages for PRs flagged "Might need backport" per release version.

## Source 2: Git Log Gap Analysis

```bash
# Count gap
git log --oneline origin/TARGET..origin/main | wc -l

# List gap commits
git log --oneline origin/TARGET..origin/main

# Check if a PR is already on target
git log --oneline origin/TARGET --grep="#PR_NUMBER"

# Check for existing backport PRs
gh pr list --base TARGET --state all --search "backport PR_NUMBER"
```

## Source 3: GitHub PR Details

```bash
# Get merge commit SHA
gh pr view $PR --json mergeCommit,title --jq '"Title: \(.title)\nMerge: \(.mergeCommit.oid)"'

# Get files changed
gh pr view $PR --json files --jq '.files[].path'
```

## Source 4: Already-Backported PRs (cross-reference)

When the target branch already has some cherry-picks on it (e.g., partway through a release window), extract the originals to avoid re-backporting:

```bash
# Get all original PR numbers already backported to TARGET since the last release tag
git log --format="%H%n%B" $LAST_TAG..origin/$TARGET \
  | grep -oiE "(backport of|cherry.picked) #?[0-9]+" \
  | grep -oE "[0-9]+" \
  | sort -un > /tmp/already-backported.txt
```

Subtract this list from your candidates.

## Reconciliation Workflow

```bash
# 1. Slack bot list (parse from export)
# /tmp/bot-flagged.txt — one PR# per line, sorted

# 2. Git gap fix/perf only
MB=$(git merge-base origin/main origin/$TARGET)
git log --format="%h|%s" $MB..origin/main \
  | grep -iE "^[a-f0-9]+\|(fix|perf)" \
  | grep -oE "#[0-9]+\)" | grep -oE "[0-9]+" \
  | sort -un > /tmp/gap-fixes.txt

# 3. Already backported (Source 4 above)

# 4. Candidates = (gap-fixes ∪ bot-flagged) − already-backported
sort -u /tmp/gap-fixes.txt /tmp/bot-flagged.txt > /tmp/union.txt
comm -23 /tmp/union.txt /tmp/already-backported.txt > /tmp/candidates.txt
```

The result is the input to the path pre-filter (`SKILL.md` Quick Start step 2).

## Output: candidate_list.md

Table per target branch:
| PR# | Title | Source (bot/gap/both) | Path bucket | Tier | Decision |
