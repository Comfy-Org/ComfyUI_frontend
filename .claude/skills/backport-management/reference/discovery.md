# Discovery — Candidate Collection

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

## Output: candidate_list.md

Table per target branch:
| PR# | Title | Category | Flagged by Bot? | Decision |
