#!/bin/bash
set -euo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd)
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT

mkdir -p "$fixture/playwright-report-cloud"
touch "$fixture/playwright-report-cloud/index.html"
"$script_dir/prepare-new-test-report.sh" "$fixture"

grep -q './playwright-report-cloud/index.html' "$fixture/index.html"
if grep -q './playwright-report-chromium/index.html' "$fixture/index.html"; then
    echo 'landing page linked a missing project' >&2
    exit 1
fi
