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
# The contract in the header is `docs/adr/*.md`. Matching the whole directory
# instead would fail a merge that adds a diagram or a fixture under it and
# report that as smuggled governance content.
pathspec='docs/adr/*.md'

if [[ "$base" =~ ^0+$ ]]; then
  exit 0
fi

# A range this script cannot resolve is not an empty range. `|| true` turned an
# unavailable base - which is what a force-push leaves behind in
# `github.event.before` - into a silent pass, so the guard reported green
# precisely when it had not looked. Exit 2 to keep "I could not run" distinct
# from the exit 1 that means "I found one".
rev_list_err="$(mktemp)"
trap 'rm -f "$rev_list_err"' EXIT
if ! merges="$(git rev-list --merges "$base..$head" 2>"$rev_list_err")"; then
  echo "ERROR: cannot resolve the revision range ${base}..${head}" >&2
  sed 's/^/       git: /' "$rev_list_err" >&2
  echo "       The guard did not run, so this is NOT evidence that no ADR was" >&2
  echo "       evil-merged. Check out with fetch-depth: 0, or pass a base that" >&2
  echo "       still exists (a force-push can orphan github.event.before)." >&2
  exit 2
fi
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
  done < <(git diff-tree -r --name-only --diff-filter=A --no-commit-id "$first_parent" "$merge" -- "$pathspec")
done

if [ "$fail" -ne 0 ]; then
  echo "One or more merge commits evil-merged files under ${path}." >&2
fi
exit "$fail"
