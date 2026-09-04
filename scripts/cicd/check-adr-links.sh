#!/bin/bash
# Description: Fails if any tracked file references a `docs/adr/*.md` path that does not exist.
#
# The ADR directory was renamed to a `TOPIC-NNNN-slug` scheme; prose references that kept
# the old shape (or guessed at it) silently resolve to nothing in exactly the review
# contexts that consume them (`.coderabbit.yaml` review paths, `.agents/checks/*` profiles).
# Needs no deps, no build and no backend.
set -euo pipefail

# git grep exit code 1 means "no matches", which is success for this check.
if refs=$(git grep -nEo 'docs/adr/[A-Za-z0-9._/-]+\.md' -- .); then
  :
else
  grep_status=$?
  if [ "$grep_status" -eq 1 ]; then
    refs=""
  else
    exit "$grep_status"
  fi
fi

if [ -z "$refs" ]; then
  exit 0
fi

fail=0
while IFS= read -r ref; do
  [ -n "$ref" ] || continue
  src="${ref%%:*}"
  rest="${ref#*:}"
  lineno="${rest%%:*}"
  target="${rest#*:}"
  if [ ! -f "$target" ]; then
    echo "ERROR: dangling docs/adr reference in $src:$lineno -> $target" >&2
    fail=1
  fi
done <<< "$refs"

if [ "$fail" -ne 0 ]; then
  echo "One or more referenced docs/adr/*.md paths do not exist. Point the reference at" >&2
  echo "the real TOPIC-NNNN-slug file under docs/adr/ (see ls docs/adr/)." >&2
fi
exit "$fail"
