#!/usr/bin/env bash

set -euo pipefail

readonly fixture='scripts/cicd/fixtures/stale-detection-proof.patch'

# The whole self-test steers by this file, and the guard's exit status alone
# cannot tell "stale" from "gone" - so check it is here before concluding
# anything from a failure.
if [[ ! -f "$fixture" ]]; then
  echo "the deliberately stale patch fixture is missing: $fixture" >&2
  exit 1
fi

if output=$(bash scripts/cicd/check-custom-node-proof-patches.sh "$fixture" 2>&1); then
  echo 'expected the deliberately stale patch fixture to fail' >&2
  exit 1
fi

# Match the whole line, not a substring: the workflow reads these as GitHub
# annotations, so a bare message with the `::error file=...::` prefix dropped
# would still satisfy a `grep -F` and would still be invisible in the run.
if ! grep -Fqx \
  "::error file=$fixture::Detection proof patch no longer applies: $fixture" \
  <<<"$output"; then
  echo 'expected an annotated stale-patch error for the fixture' >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

# The missing-patch branch needs its own case, or the guard could report every
# absent file as stale and this file would never notice.
readonly absent='scripts/cicd/fixtures/this-patch-does-not-exist.patch'

if [[ -e "$absent" ]]; then
  echo "the absent-patch case needs a path that does not exist: $absent" >&2
  exit 1
fi

if output=$(bash scripts/cicd/check-custom-node-proof-patches.sh "$absent" 2>&1); then
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
