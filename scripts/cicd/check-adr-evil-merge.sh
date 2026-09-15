#!/bin/bash
# Description: Fails when a merge commit in the scanned range introduces a
# `docs/adr/*.md` file that is present in NEITHER of its parents ("evil merge"
# of governance content). Per-commit review tooling (`gh pr diff --patch`,
# incremental bot reviews) cannot see content that only exists inside a merge
# commit, so governance artifacts smuggled in that way take zero review.
# Added by phs-48 after AGENT-SESSION-0028 landed inside PR #16768's
# "merge main" commit (own commit on main: #17483).
#
# Usage: check-adr-evil-merge.sh <base-rev> [head-rev]
#   <base-rev>  exclusive range start (e.g. PR base sha, or `github.event.before`)
#   [head-rev]  inclusive range end, defaults to HEAD
# An all-zero base (new-branch push) is a no-op success. The range scan needs
# merge-commit history: run the workflow with `fetch-depth: 0`.
set -euo pipefail

base="${1:?usage: check-adr-evil-merge.sh <base-rev> [head-rev]}"
head="${2:-HEAD}"
path='docs/adr/'

if [[ "$base" =~ ^0+$ ]]; then
  exit 0
fi

merges="$(git rev-list --merges "$base..$head" 2>/dev/null || true)"
if [ -z "$merges" ]; then
  exit 0
fi

fail=0
for merge in $merges; do
  # `rev-list --parents -n 1` prints "<merge> <parent1> <parent2> ..."
  parents="$(git rev-list --parents -n 1 "$merge")"
  read -r _ first_parent other_parents <<< "$parents"
  # Files ADDED relative to parent 1 under docs/adr/; then reject when no
  # other parent contains the file either, i.e. it exists only in the merge.
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    in_some_parent=0
    for parent in $other_parents; do
      if git cat-file -e "${parent}:${file}" 2>/dev/null; then
        in_some_parent=1
        break
      fi
    done
    if [ "$in_some_parent" -eq 0 ]; then
      echo "ERROR: merge $(git rev-parse --short "$merge") introduces ${file}" >&2
      echo "       present in neither of its parents — ADR governance content must land" >&2
      echo "       on its own commit so per-commit review tools can see it." >&2
      fail=1
    fi
  done < <(git diff-tree -r --name-only --diff-filter=A --no-commit-id "$first_parent" "$merge" -- "$path")
done

if [ "$fail" -ne 0 ]; then
  echo "One or more merge commits evil-merged files under ${path}." >&2
fi
exit "$fail"
