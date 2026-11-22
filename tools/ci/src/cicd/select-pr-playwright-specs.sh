#!/usr/bin/env bash
set -euo pipefail

base_sha=${1:?base SHA is required}
head_sha=${2:?PR head SHA is required}

for sha in "$base_sha" "$head_sha"; do
  git cat-file -e "${sha}^{commit}" || {
    echo "Required PR commit is not available: $sha" >&2
    exit 1
  }
done

git diff --name-only --diff-filter=AMR "${base_sha}...${head_sha}" -- \
  'browser_tests/**/*.spec.ts'
