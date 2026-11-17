#!/usr/bin/env bash
# Retries a `gh` CLI call on a rate-limit failure. `gh` does not expose
# response headers the way raw `fetch` does (see github-rest.ts), so the
# error text is the only available signal: this retries on an HTTP 403/429
# or the literal "rate limit" phrase rather than trying to separate primary
# from secondary limits. Two consecutive release incidents (a manual
# recovery hitting "API rate limit exceeded", and a follow-up run hitting
# it again) ran these exact calls bare with no retry at all.
set -uo pipefail

readonly ATTEMPTS=3
readonly RETRY_DELAY_SECONDS=${GH_RETRY_DELAY_SECONDS:-2}
readonly MAX_RETRY_DELAY_SECONDS=${GH_RETRY_MAX_DELAY_SECONDS:-30}

is_rate_limited() {
  grep -qiE 'rate limit|HTTP 403|HTTP 429' "$1"
}

stdout_file=$(mktemp)
stderr_file=$(mktemp)
trap 'rm -f "$stdout_file" "$stderr_file"' EXIT

delay=$RETRY_DELAY_SECONDS
attempt=1
while true; do
  # Capture status from the command itself, not from an `if` wrapping it:
  # `if cmd; then ...; fi` with no `else` reports 0 as its OWN exit status
  # once the condition is false and the branch is skipped, regardless of
  # what `cmd` actually returned.
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
