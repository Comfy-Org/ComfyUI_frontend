#!/usr/bin/env bash
set -euo pipefail

if [[ "$CHANGES_RESULT" != success ]]; then
  echo "Website E2E change detection failed (changes: $CHANGES_RESULT)"
  exit 1
fi

case "$SHOULD_RUN" in
  false)
    if [[ "$SHARD_RESULT" != skipped || "$REPORT_RESULT" != skipped ]]; then
      echo "Website E2E ran unexpectedly (shards: $SHARD_RESULT, report: $REPORT_RESULT)"
      exit 1
    fi
    echo "Website E2E skipped (no relevant changes)"
    ;;
  true)
    if [[ "$SHARD_RESULT" != success || "$REPORT_RESULT" != success || "$TEST_OUTCOME" != success ]]; then
      echo "Website E2E failed (shards: $SHARD_RESULT, report: $REPORT_RESULT, outcome: $TEST_OUTCOME)"
      exit 1
    fi
    echo "Website E2E passed"
    ;;
  *)
    echo "Website E2E gate received an unexpected SHOULD_RUN value: '$SHOULD_RUN'"
    exit 1
    ;;
esac
