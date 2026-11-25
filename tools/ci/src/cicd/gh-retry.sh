#!/usr/bin/env bash
set -uo pipefail

readonly ATTEMPTS=3
readonly RETRY_DELAY_SECONDS=${GH_RETRY_DELAY_SECONDS:-60}
readonly MAX_RETRY_DELAY_SECONDS=${GH_RETRY_MAX_DELAY_SECONDS:-120}

is_rate_limited() {
  grep -qiE 'rate limit|HTTP 403|HTTP 429' "$1"
}

stdout_file=$(mktemp)
stderr_file=$(mktemp)
trap 'rm -f "$stdout_file" "$stderr_file"' EXIT

delay=$RETRY_DELAY_SECONDS
attempt=1
while true; do
  gh "$@" >"$stdout_file" 2>"$stderr_file"
  status=$?
  if ((status == 0)); then
    cat "$stdout_file"
    cat "$stderr_file" >&2
    exit 0
  fi
  if ((attempt >= ATTEMPTS)) || ! is_rate_limited "$stderr_file"; then
    cat "$stdout_file"
    cat "$stderr_file" >&2
    exit "$status"
  fi
  echo "::warning::gh $* hit a rate limit (attempt ${attempt}/${ATTEMPTS}); retrying in ${delay}s" >&2
  sleep "$delay"
  delay=$((delay * 2 < MAX_RETRY_DELAY_SECONDS ? delay * 2 : MAX_RETRY_DELAY_SECONDS))
  attempt=$((attempt + 1))
done
