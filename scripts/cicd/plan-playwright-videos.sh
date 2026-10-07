#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo '{"include":[]}'
  exit 0
fi

report=$(mktemp)
trap 'rm -f "$report"' EXIT
PLAYWRIGHT_JSON_OUTPUT_NAME="$report" pnpm exec playwright test \
  --project=chromium --project=cloud --list --reporter=json \
  --pass-with-no-tests "$@" >&2

jq -c '
  [.. | objects | .tests? // empty | .[] | .projectName]
  | group_by(.)
  | {include: [
      .[] | .[0] as $project
      | ([((length / 50) | ceil), 16] | min) as $total
      | range(1; $total + 1)
      | {project: $project, shardIndex: ., shardTotal: $total}
    ]}
' "$report"
