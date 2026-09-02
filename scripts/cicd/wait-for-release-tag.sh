#!/usr/bin/env bash
# Failing here skips create-comfyui-pr, so the timeout has to hand over its own recovery.
set -euo pipefail

: "${REPO:?REPO is required}"
: "${TARGET_VERSION:?TARGET_VERSION is required}"
: "${TARGET_BRANCH:?TARGET_BRANCH is required}"
: "${RUN_ID:?RUN_ID is required}"
: "${GH_TOKEN:?GH_TOKEN is required}"

timeout_seconds=${TIMEOUT_SECONDS:-14400}
poll_seconds=${POLL_SECONDS:-30}
readonly TAG="v${TARGET_VERSION}"

echo "Waiting up to $((timeout_seconds / 3600))h for ${TAG} on ${TARGET_BRANCH}..."

deadline=$((SECONDS + timeout_seconds))
while ((SECONDS < deadline)); do
  if api_error=$(gh api "repos/${REPO}/git/ref/tags/${TAG}" --silent 2>&1); then
    echo "${TAG} found — the bump PR has been merged."
    exit 0
  fi
  if [[ "$api_error" != *"HTTP 404"* ]]; then
    echo "::error title=Unexpected error polling for release tag::${api_error}"
    exit 1
  fi
  echo "${TAG} not found yet; $((deadline - SECONDS))s of budget left."
  sleep "$poll_seconds"
done

readonly RECOVERY="gh run rerun ${RUN_ID} --failed"
echo "::error title=Release tag never appeared::${TAG} was not created in time. Check whether the Release-labeled bump PR for ${TARGET_BRANCH} is merged; if it is, open its release-draft-create run and check the individual jobs. Recover with: ${RECOVERY}"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >>"$GITHUB_STEP_SUMMARY" <<EOF
## Release stalled — \`${TAG}\` never appeared

Timed out on \`${TARGET_BRANCH}\`. Check the two causes in order:

1. **Is the Release-labeled bump PR for \`${TARGET_BRANCH}\` merged?** If not, merge it.
2. **If it is merged**, open its \`release-draft-create\` run and check the individual jobs — a cosmetic step can mark an otherwise-successful run failed.

Recover once the tag exists:

\`\`\`bash
${RECOVERY}
\`\`\`
EOF
fi

exit 1
