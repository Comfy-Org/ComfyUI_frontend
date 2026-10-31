#!/usr/bin/env bash
set -euo pipefail

: "${EVENT_NAME:?EVENT_NAME is required}"
: "${GH_TOKEN:?PR_GH_TOKEN is required for cloud tag reconciliation}"
: "${BRANCH:?BRANCH is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"

if [[ ! "$BRANCH" =~ ^cloud/([0-9]+)\.([0-9]+)$ ]]; then
  echo "::error::Base branch is not a cloud/x.y branch"
  exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"

GH_API_MAX_ATTEMPTS="${GH_API_MAX_ATTEMPTS:-4}"
GH_API_RETRY_BUDGET_SECONDS="${GH_API_RETRY_BUDGET_SECONDS:-300}"
# gh api hides Retry-After unless --include mixes headers into the output, so use GitHub's documented 60s fallback.
GH_API_SECONDARY_RATE_LIMIT_WAIT_SECONDS=60
GH_API_STARTED_AT=$(date +%s)
GH_API_WAITED_FILE=$(mktemp)
trap 'rm -f "$GH_API_WAITED_FILE"' EXIT

rate_limit_wait_seconds() {
  local remaining reset
  IFS=$'\t' read -r remaining reset < <(gh api rate_limit \
    --jq '[.resources.core.remaining, .resources.core.reset] | @tsv' 2>/dev/null) || return 1
  [[ "$remaining" == 0 && "$reset" =~ ^[0-9]+$ ]] || return 1
  local wait=$((reset - $(date +%s) + 1))
  printf '%s\n' $((wait > 0 ? wait : 1))
}

# Retries rate-limit and 5xx responses within one retry budget shared by every
# call in the run; every other failure returns at once.
gh_api() {
  local attempt=1 backoff=5 elapsed endpoint="$1" arg error_file output reset_note status wait waited
  for arg in "$@"; do
    [[ "$arg" == repos/* ]] && endpoint="$arg"
  done
  error_file=$(mktemp)
  while true; do
    output=$(gh api "$@" 2>"$error_file") && status=0 || status=$?
    if [[ "$status" -eq 0 ]]; then
      cat "$error_file" >&2
      rm -f "$error_file"
      printf '%s\n' "$output"
      return 0
    fi
    cat "$error_file" >&2
    waited=$(cat "$GH_API_WAITED_FILE")
    elapsed=$(($(date +%s) - GH_API_STARTED_AT))
    elapsed=$((elapsed > ${waited:-0} ? elapsed : ${waited:-0}))
    if grep -Eqi 'rate limit|HTTP 429' "$error_file"; then
      if wait=$(rate_limit_wait_seconds); then
        reset_note=" (next reset in ${wait}s)"
      else
        wait="$GH_API_SECONDARY_RATE_LIMIT_WAIT_SECONDS"
        reset_note=""
      fi
      if [[ "$attempt" -ge "$GH_API_MAX_ATTEMPTS" ]] \
        || ((elapsed + wait > GH_API_RETRY_BUDGET_SECONDS)); then
        echo "::error::GitHub API rate limited on ${endpoint}; gave up after ${attempt} attempt(s) and ${elapsed}s${reset_note}" >&2
        rm -f "$error_file"
        return "$status"
      fi
    elif grep -Eq 'HTTP 5[0-9]{2}' "$error_file"; then
      if [[ "$attempt" -ge "$GH_API_MAX_ATTEMPTS" ]] \
        || ((elapsed + backoff > GH_API_RETRY_BUDGET_SECONDS)); then
        echo "::error::GitHub API ${endpoint} failed after ${attempt} attempt(s) and ${elapsed}s" >&2
        rm -f "$error_file"
        return "$status"
      fi
      wait="$backoff"
    else
      rm -f "$error_file"
      return "$status"
    fi
    echo "::warning::GitHub API request ${endpoint} failed (attempt ${attempt}/${GH_API_MAX_ATTEMPTS}); retrying in ${wait}s" >&2
    sleep "$wait"
    printf '%s' $((elapsed + wait)) > "$GH_API_WAITED_FILE"
    attempt=$((attempt + 1))
    backoff=$((backoff * 2))
  done
}

if [[ "$EVENT_NAME" == "workflow_dispatch" ]]; then
  SHA="$(printf '%s' "${SHA:-}" | tr -d '[:space:]')"
  SHA="${SHA,,}"
  if [[ -z "$SHA" ]]; then
    SHA=$(gh_api "repos/${GITHUB_REPOSITORY}/git/ref/heads/${BRANCH}" --jq '.object.sha')
  fi
elif [[ -z "${SHA:-}" ]]; then
  echo "::error::Merged pull request payload did not include merge_commit_sha"
  exit 1
fi

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::Commit must be a full 40-character SHA"
  exit 1
fi

if ! CONTAINMENT=$(gh_api "repos/${GITHUB_REPOSITORY}/compare/${BRANCH}...${SHA}" --jq '.status'); then
  echo "::error::Failed to verify that commit ${SHA} belongs to ${BRANCH}"
  exit 1
fi
if [[ "$CONTAINMENT" != "behind" && "$CONTAINMENT" != "identical" ]]; then
  echo "::error::Commit ${SHA} is not contained in ${BRANCH} (compare status: ${CONTAINMENT})"
  exit 1
fi

VERSION=$(gh_api "repos/${GITHUB_REPOSITORY}/contents/package.json?ref=${SHA}" \
  -H 'Accept: application/vnd.github.raw+json' | jq -r '.version')
if [[ ! "$VERSION" =~ ^${MAJOR}\.${MINOR}\.([0-9]+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::Package version does not match the selected cloud branch"
  exit 1
fi

TAG="cloud/v${VERSION}"

read_tag_object() {
  local error_file output
  error_file=$(mktemp)
  if output=$(gh_api "repos/${GITHUB_REPOSITORY}/git/ref/tags/${TAG}" \
    --jq '[.object.type, .object.sha] | @tsv' \
    2>"$error_file"); then
    cat "$error_file" >&2
    rm -f "$error_file"
    printf '%s\n' "$output"
    return 0
  fi
  if grep -Eq 'HTTP 404' "$error_file"; then
    grep -v 'HTTP 404' "$error_file" >&2 || true
    rm -f "$error_file"
    return 1
  fi
  cat "$error_file" >&2
  rm -f "$error_file"
  return 2
}

resolve_tag_commit() {
  local object_type="$1" object_sha="$2" depth=0 peeled
  while [[ "$object_type" == "tag" && "$depth" -lt 5 ]]; do
    peeled=$(gh_api "repos/${GITHUB_REPOSITORY}/git/tags/${object_sha}" \
      --jq '[.object.type, .object.sha] | @tsv')
    IFS=$'\t' read -r object_type object_sha <<< "$peeled"
    depth=$((depth + 1))
  done
  if [[ "$object_type" != "commit" ]]; then
    echo "::error::Tag ${TAG} does not resolve to a commit" >&2
    return 1
  fi
  printf '%s\n' "$object_sha"
}

handle_existing_tag() {
  local object="$1" object_type object_sha existing_commit
  IFS=$'\t' read -r object_type object_sha <<< "$object"
  existing_commit=$(resolve_tag_commit "$object_type" "$object_sha")
  if [[ "$existing_commit" == "$SHA" ]]; then
    echo "::notice::Tag ${TAG} already exists at ${existing_commit}; skipping"
    echo "Tag ${TAG} already exists at ${existing_commit}; no change required." >> "$GITHUB_STEP_SUMMARY"
  else
    local existing_containment
    if ! existing_containment=$(gh_api "repos/${GITHUB_REPOSITORY}/compare/${BRANCH}...${existing_commit}" --jq '.status'); then
      echo "::error::Failed to verify existing tag ${TAG} against ${BRANCH}"
      return 1
    fi
    if [[ "$existing_containment" != "behind" && "$existing_containment" != "identical" ]]; then
      echo "::error::Existing tag ${TAG} is not contained in ${BRANCH}"
      return 1
    fi
    echo "::warning::Tag ${TAG} already marks ${existing_commit}; ${SHA} is another backport for the same package version, so the first release marker is preserved"
    echo "Tag ${TAG} remains at ${existing_commit}; ${SHA} is another backport for the same package version." >> "$GITHUB_STEP_SUMMARY"
  fi
  echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
}

if existing_object=$(read_tag_object); then
  handle_existing_tag "$existing_object"
  exit 0
else
  lookup_status=$?
  if [[ "$lookup_status" -ne 1 ]]; then
    echo "::error::Failed to inspect tag ${TAG}"
    exit "$lookup_status"
  fi
fi

if ! gh_api --method POST "repos/${GITHUB_REPOSITORY}/git/refs" \
  -f ref="refs/tags/${TAG}" \
  -f sha="${SHA}" \
  --jq '.ref'; then
  # Two runs can both pass the lookup; GitHub rejects the loser with 422.
  if existing_object=$(read_tag_object); then
    handle_existing_tag "$existing_object"
    exit 0
  fi
  echo "::error::Failed to create tag ${TAG} at ${SHA}"
  exit 1
fi

echo "tag=${TAG}" >> "$GITHUB_OUTPUT"
{
  echo "Created tag: ${TAG}"
  echo "Branch: ${BRANCH}"
  echo "Version: ${VERSION}"
  echo "Commit: ${SHA}"
} >> "$GITHUB_STEP_SUMMARY"
