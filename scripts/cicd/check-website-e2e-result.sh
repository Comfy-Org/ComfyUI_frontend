#!/usr/bin/env bash
set -euo pipefail

if [[ "$SHOULD_RUN" != true ]]; then
  echo "Website E2E skipped (no relevant changes)"
  exit 0
fi

if [[ "$SHARD_RESULT" != success || "$REPORT_RESULT" != success || "$TEST_OUTCOME" != success ]]; then
  echo "Website E2E failed (shards: $SHARD_RESULT, report: $REPORT_RESULT, outcome: $TEST_OUTCOME)"
  exit 1
fi

echo "Website E2E passed"
