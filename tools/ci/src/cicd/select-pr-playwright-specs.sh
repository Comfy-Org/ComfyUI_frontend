#!/usr/bin/env bash
set -euo pipefail

base_sha=${1:?base SHA is required}
head_sha=${2:?PR head SHA is required}
# Optional: a ref for the branch these recordings are reviewed against. When it
# resolves, a spec whose head content already matches that branch is not this
# pull request's to record. Unset or unresolvable leaves the base diff untouched.
default_branch_ref=${DEFAULT_BRANCH_REF:-}

for sha in "$base_sha" "$head_sha"; do
  git cat-file -e "${sha}^{commit}" || {
    echo "Required PR commit is not available: $sha" >&2
    exit 1
  }
done

blob_at() {
  git rev-parse --quiet --verify "${1}:${2}" || true
}

candidates=$(git diff --name-only --diff-filter=AMR "${base_sha}...${head_sha}" -- \
  'browser_tests/**/*.spec.ts')

# The newest default-branch commit this head already contains, so a spec the
# default branch changed after the head last merged it still compares equal.
default_branch_point=
if [ -n "$default_branch_ref" ] &&
  git rev-parse --quiet --verify "${default_branch_ref}^{commit}" > /dev/null; then
  default_branch_point=$(git merge-base "$head_sha" "$default_branch_ref" || true)
fi

if [ -z "$candidates" ] || [ -z "$default_branch_point" ]; then
  [ -z "$candidates" ] || printf '%s\n' "$candidates"
  exit 0
fi

# A pull request based on a stale branch carries every spec the default branch
# has changed since the branch point, so the base diff alone selects hundreds of
# other authors' specs. Recording them wastes the whole job on work nobody in
# this review will read, and inherits every pre-existing flake as a hard red
# because the recording run disables retries.
while IFS= read -r file; do
  [ -n "$file" ] || continue
  head_blob=$(blob_at "$head_sha" "$file")
  default_blob=$(blob_at "$default_branch_point" "$file")
  if [ -n "$default_blob" ] && [ "$head_blob" = "$default_blob" ]; then
    continue
  fi
  printf '%s\n' "$file"
done <<< "$candidates"
