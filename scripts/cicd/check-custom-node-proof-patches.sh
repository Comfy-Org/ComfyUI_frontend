#!/usr/bin/env bash

set -euo pipefail

if (( $# > 0 )); then
  patches=("$@")
else
  shopt -s nullglob
  patches=(browser_tests/tests/customNodes/detection-proof/*.patch)
fi

if (( ${#patches[@]} == 0 )); then
  echo '::error::No custom-node detection proof patches found'
  exit 1
fi

failed=0
for patch in "${patches[@]}"; do
  if ! git apply --check "$patch"; then
    echo "::error file=$patch::Detection proof patch no longer applies: $patch"
    failed=1
  fi
done

exit "$failed"
