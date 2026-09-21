#!/usr/bin/env bash
# Writes the created pull request branch's final git state into
# bin/created-pr/ for the building-web-prs workflow graders: every main..branch
# commit message, the changed files, and the diff. Installed as the fixture
# repository's post-commit, post-rewrite, post-checkout and post-merge hooks
# by the gh stand-in when `pr create` succeeds, so a commit or amend after the
# last gh call still lands in the snapshot. Fails loudly on any git error.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
[[ -x "$here/git" ]] && git() { "$here/git" "$@"; }
state="$here/state"
[[ -f "$state/created_pr_branch" ]] || exit 0
b="$(cat "$state/created_pr_branch")"
mkdir -p "$here/created-pr"
git -C "$repo" log --format='>>> %h %s%n%b' "main..$b" > "$here/created-pr/commit-messages.txt"
git -C "$repo" diff --name-only "main...$b" > "$here/created-pr/changed-files.txt"
git -C "$repo" diff "main...$b" > "$here/created-pr/diff.patch"
git -C "$repo" rev-parse "$b" | tr -d '\n' > "$state/head_sha"
