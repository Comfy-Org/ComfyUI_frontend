#!/usr/bin/env bash

set -euo pipefail

readonly fixture='scripts/cicd/fixtures/stale-detection-proof.patch'

if output=$(bash scripts/cicd/check-custom-node-proof-patches.sh "$fixture" 2>&1); then
  echo 'expected the deliberately stale patch fixture to fail' >&2
  exit 1
fi

grep -Fq "Detection proof patch no longer applies: $fixture" <<<"$output"
