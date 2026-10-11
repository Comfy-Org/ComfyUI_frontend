#!/usr/bin/env bash
set -euo pipefail

reports_dir=$1
expected_reports=$2
playwright_version=$3
report_count=0
if [[ -d "$reports_dir" ]]; then
  report_count=$(find "$reports_dir" -type f -name '*.zip' | wc -l)
fi

infrastructure_failure() {
  echo "$1" >&2
  echo "result=infrastructure" >> "$GITHUB_OUTPUT"
}

if [[ "$BLOB_REPORTS_OUTCOME" != success || "$report_count" -ne "$expected_reports" ]]; then
  infrastructure_failure "Incomplete blob reports ($report_count/$expected_reports)"
  exit 0
fi

if ! pnpm dlx "@playwright/test@$playwright_version" merge-reports --reporter=html "$reports_dir" ||
  ! PLAYWRIGHT_JSON_OUTPUT_NAME=results.json pnpm dlx "@playwright/test@$playwright_version" merge-reports --reporter=json "$reports_dir"; then
  infrastructure_failure "Failed to merge blob reports"
  exit 0
fi

if [[ "$SHARDS_RESULT" == success ]]; then
  echo "result=success" >> "$GITHUB_OUTPUT"
else
  echo "result=failure" >> "$GITHUB_OUTPUT"
fi
