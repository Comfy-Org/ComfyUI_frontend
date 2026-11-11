#!/usr/bin/env bash
# "Backport commits" step of .github/workflows/pr-backport.yaml: cherry-picks
# the merged PR onto each pending target and pushes a backport branch.
#
# Inputs (env): EVENT_NAME, PR_NUMBER, PENDING_TARGETS (space-separated),
# GITHUB_EVENT_PATH, GITHUB_OUTPUT.
# Outputs: success, failed, already-applied.
#
# `set -e` without pipefail matches the step's default `bash -e` shell.
set -e

FAILED=""
SUCCESS=""
ALREADY_APPLIED=""

# Get PR data for manual triggers
if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  PR_DATA=$(gh pr view "$PR_NUMBER" --json mergeCommit)
  MERGE_COMMIT=$(echo "$PR_DATA" | jq -r '.mergeCommit.oid')
else
  MERGE_COMMIT=$(jq -r '.pull_request.merge_commit_sha' "$GITHUB_EVENT_PATH")
fi

for target in $PENDING_TARGETS; do
  TARGET_BRANCH="${target}"
  SAFE_TARGET=$(echo "$TARGET_BRANCH" | tr '/' '-')
  BACKPORT_BRANCH="backport-${PR_NUMBER}-to-${SAFE_TARGET}"
  REMOTE_BACKPORT_EXISTS=false

  if git ls-remote --exit-code origin "${BACKPORT_BRANCH}" >/dev/null 2>&1; then
    REMOTE_BACKPORT_EXISTS=true
    echo "::notice::Updating existing branch ${BACKPORT_BRANCH}"
  fi

  echo "::group::Backporting to ${TARGET_BRANCH}"

  # Fetch target branch (fail if doesn't exist)
  if ! git fetch origin "${TARGET_BRANCH}"; then
    echo "::error::Target branch ${TARGET_BRANCH} does not exist"
    FAILED="${FAILED}${TARGET_BRANCH}:branch-missing "
    echo "::endgroup::"
    continue
  fi

  # Check if commit already exists on target branch
  if git branch -r --contains "${MERGE_COMMIT}" | grep -q "origin/${TARGET_BRANCH}"; then
    echo "::notice::Commit ${MERGE_COMMIT} already exists on ${TARGET_BRANCH}, skipping backport"
    FAILED="${FAILED}${TARGET_BRANCH}:already-exists "
    echo "::endgroup::"
    continue
  fi

  # Create backport branch. A failure here (e.g. dirty state left
  # by a prior target) must not abort the loop and skip remaining
  # targets, so fall back to a clean checkout and record the error.
  if ! git checkout -B "${BACKPORT_BRANCH}" "origin/${TARGET_BRANCH}"; then
    echo "::error::Failed to create branch ${BACKPORT_BRANCH} for ${TARGET_BRANCH}"
    FAILED="${FAILED}${TARGET_BRANCH}:branch-create-failed "
    git checkout main || git checkout -f main
    echo "::endgroup::"
    continue
  fi

  # Try cherry-pick
  if git cherry-pick "${MERGE_COMMIT}"; then
    if [ "$REMOTE_BACKPORT_EXISTS" = true ]; then
      PUSH_CMD=(git push --force-with-lease origin "${BACKPORT_BRANCH}")
    else
      PUSH_CMD=(git push origin "${BACKPORT_BRANCH}")
    fi

    # A push failure for one target must not abort the loop and
    # prevent remaining targets from being attempted.
    if "${PUSH_CMD[@]}"; then
      SUCCESS="${SUCCESS}${TARGET_BRANCH}:${BACKPORT_BRANCH} "
      echo "Successfully created backport branch: ${BACKPORT_BRANCH}"
    else
      echo "::error::Failed to push ${BACKPORT_BRANCH} for ${TARGET_BRANCH}"
      FAILED="${FAILED}${TARGET_BRANCH}:push-failed "
    fi

    # Return to main (keep the branch, we need it for PR)
    git checkout main || git checkout -f main
  else
    CONFLICTS=$(git diff --name-only --diff-filter=U | tr '\n' ',')
    CHANGES_ALREADY_ON_TARGET=false
    if [ -z "${CONFLICTS}" ] &&
      git rev-parse -q --verify CHERRY_PICK_HEAD >/dev/null &&
      git diff --cached --quiet HEAD; then
      CHANGES_ALREADY_ON_TARGET=true
    fi
    git cherry-pick --abort || true

    if [ "$CHANGES_ALREADY_ON_TARGET" = true ]; then
      echo "::notice::${TARGET_BRANCH} already has the changes from ${MERGE_COMMIT}, skipping backport"
      ALREADY_APPLIED="${ALREADY_APPLIED}${TARGET_BRANCH} "
    else
      echo "::error::Cherry-pick failed due to conflicts"
      FAILED="${FAILED}${TARGET_BRANCH}:conflicts:${CONFLICTS} "
    fi

    # Clean up the failed branch
    git checkout main || git checkout -f main
    git branch -D "${BACKPORT_BRANCH}" || true
  fi

  echo "::endgroup::"
done

{
  echo "success=${SUCCESS}"
  echo "failed=${FAILED}"
  echo "already-applied=${ALREADY_APPLIED}"
} >> "$GITHUB_OUTPUT"

# Do not exit non-zero when only some targets failed: the clean
# backports must still get their PRs (next step) and the conflicts
# must still be reported. A dedicated final step re-reds the run so
# the failure stays visible and retryable.