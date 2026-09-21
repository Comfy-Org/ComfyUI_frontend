#!/usr/bin/env bash
# Require a pull request that disables a test to name the work that restores it.
set -euo pipefail

base_sha="${1:?usage: check-disabled-test-tracking.sh <base_sha> <head_sha> [body_file]}"
head_sha="${2:?usage: check-disabled-test-tracking.sh <base_sha> <head_sha> [body_file]}"
body_file="${3-}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! violations="$(
  python3 "$script_dir/find_new_disabled_tests.py" "$base_sha" "$head_sha"
)"; then
  echo "::error::Could not inspect the pull request diff for disabled tests." >&2
  exit 1
fi

if [[ -z "$violations" ]]; then
  echo "No newly disabled tests in this pull request."
  exit 0
fi

body=""
if [[ -n "$body_file" ]]; then
  if [[ ! -f "$body_file" ]]; then
    echo "::error::Pull request body file does not exist: $body_file" >&2
    exit 1
  fi
  body="$(cat -- "$body_file")"
fi

# A generic issue token can describe unrelated work. Require the reference to
# appear on the same line as explicit disabled-test restoration intent.
REFERENCE_RE='(#[0-9]+|https://github\.com/[^[:space:]]+/(issues|pull)/[0-9]+|https://linear\.app/[^[:space:]]+)'
INTENT_RE='(re-?enabl(e|ed|ing)?|restor(e|ed|es|ing|ation)|disabled[- ]test([[:space:]-]+follow[- ]?up)?|test[[:space:]-]+restoration)'

if grep -Eiq \
  "${INTENT_RE}[^[:cntrl:]]{0,160}${REFERENCE_RE}|${REFERENCE_RE}[^[:cntrl:]]{0,160}${INTENT_RE}" \
  <<<"$body"; then
  echo "This pull request disables tests and names the restoration work:"
  echo ""
  echo "$violations"
  exit 0
fi

echo "::error::This pull request disables a test but its body names no restoration work."
echo ""
echo "Newly disabled:"
echo ""
echo "$violations"
echo "A disabled test is a promise to restore it, and the body is the only"
echo "place that promise survives. Add a tracking issue or follow-up PR with"
echo "explicit restoration intent, for example:"
echo ""
echo "  Re-enabled by #12345"
echo "  Test restoration tracked in https://linear.app/comfyorg/issue/FE-1234"
echo ""
echo "If a test is being retired rather than parked, delete it instead of"
echo "disabling it, and say so in the body."
exit 1
