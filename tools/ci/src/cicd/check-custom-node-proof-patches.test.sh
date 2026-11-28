#!/usr/bin/env bash

set -euo pipefail

readonly fixture='tools/ci/src/cicd/fixtures/stale-detection-proof.patch'

if [[ ! -f "$fixture" ]]; then
  echo "the deliberately stale patch fixture is missing: $fixture" >&2
  exit 1
fi

if output=$(bash tools/ci/src/cicd/check-custom-node-proof-patches.sh "$fixture" 2>&1); then
  echo 'expected the deliberately stale patch fixture to fail' >&2
  exit 1
fi

if ! grep -Fqx \
  "::error file=$fixture::Detection proof patch no longer applies: $fixture" \
  <<<"$output"; then
  echo 'expected an annotated stale-patch error for the fixture' >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

readonly absent='tools/ci/src/cicd/fixtures/this-patch-does-not-exist.patch'

if [[ -e "$absent" ]]; then
  echo "the absent-patch case needs a path that does not exist: $absent" >&2
  exit 1
fi

if output=$(bash tools/ci/src/cicd/check-custom-node-proof-patches.sh "$absent" 2>&1); then
  echo 'expected a missing patch path to fail' >&2
  exit 1
fi

if ! grep -Fqx \
  "::error file=$absent::Detection proof patch is missing: $absent" \
  <<<"$output"; then
  echo 'expected an annotated missing-patch error, not a stale-patch one' >&2
  printf '%s\n' "$output" >&2
  exit 1
fi
