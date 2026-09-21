#!/usr/bin/env bash
# Requires a pull request that disables a test to say what will restore it.
#
# A `test.fixme`/`.skip` landed to unblock a red `main` is a promise to come
# back. When the PR body does not name the issue or follow-up PR that will
# restore it, the promise is unrecoverable: the next person has to reconstruct
# the failure direction from commit timestamps. That happened on #16907, which
# disabled a spec with an empty body.
#
# Only DISABLING forms are matched — a declaration whose first argument is a
# string literal, e.g. `test.fixme('name', ...)`. Playwright's conditional
# `test.skip(condition, 'reason')` and bare `test.skip()` are runtime controls
# rather than a test taken out of service, so they are left alone.
set -euo pipefail

base_sha="${1:?usage: check-disabled-test-tracking.sh <base_sha> <head_sha> [body_file]}"
head_sha="${2:?usage: check-disabled-test-tracking.sh <base_sha> <head_sha> [body_file]}"
body_file="${3-}"

# `test.fixme('…'`, `it.skip("…"`, `test.describe.skip(\`…`, and so on.
DISABLE_RE='\b(test|it|describe)(\.describe)?\.(skip|fixme)\([[:space:]]*['"'"'"`]'

# Test sources only: a doc or changelog mentioning `test.fixme` is not a
# disabled test.
mapfile -t changed < <(
    git diff --name-only --diff-filter=d "${base_sha}...${head_sha}" -- \
        '*.spec.ts' '*.spec.js' '*.spec.mts' \
        '*.test.ts' '*.test.js' '*.test.mts' || true
)

violations=""
for file in "${changed[@]}"; do
    [[ -n "$file" ]] || continue
    # Added lines only. A disable that was already on the base branch is not
    # this PR's debt to justify.
    added="$(
        git diff -U0 "${base_sha}...${head_sha}" -- "$file" |
            grep -E '^\+' | grep -Ev '^\+\+\+' | sed 's/^+//' || true
    )"
    [[ -n "$added" ]] || continue
    hits="$(grep -nE "$DISABLE_RE" <<<"$added" || true)"
    [[ -n "$hits" ]] || continue
    while IFS= read -r hit; do
        violations+="  ${file}: ${hit#*:}"$'\n'
    done <<<"$hits"
done

if [[ -z "$violations" ]]; then
    echo "No newly disabled tests in this pull request."
    exit 0
fi

body=""
if [[ -n "$body_file" && -f "$body_file" ]]; then
    body="$(cat "$body_file")"
fi

# An issue or PR reference: `#123`, a GitHub issue/PR URL, or a Linear ticket.
REFERENCE_RE='(#[0-9]+|https://github\.com/[^[:space:]]+/(issues|pull)/[0-9]+|https://linear\.app/[^[:space:]]+)'

if grep -qE "$REFERENCE_RE" <<<"$body"; then
    echo "This pull request disables tests and its body references the follow-up:"
    echo ""
    echo "$violations"
    exit 0
fi

echo "::error::This pull request disables a test but its body names no follow-up."
echo ""
echo "Newly disabled:"
echo ""
echo "$violations"
echo "A disabled test is a promise to restore it, and the body is the only"
echo "place that promise survives. Add the tracking issue or the follow-up PR"
echo "that will re-enable these, for example:"
echo ""
echo "  Re-enabled by #12345"
echo "  Tracked in https://linear.app/comfyorg/issue/FE-1234"
echo ""
echo "If a test is being retired rather than parked, delete it instead of"
echo "disabling it, and say so in the body."
exit 1
