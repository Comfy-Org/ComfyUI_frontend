#!/usr/bin/env bash
set -euo pipefail

: "${EVENT_NAME:?EVENT_NAME is required}"
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

if [[ "$EVENT_NAME" == "workflow_dispatch" ]]; then
  SHA="$(printf '%s' "${SHA:-}" | tr -d '[:space:]')"
  SHA="${SHA,,}"
  if [[ -z "$SHA" ]]; then
    SHA=$(gh api "repos/${GITHUB_REPOSITORY}/git/ref/heads/${BRANCH}" --jq '.object.sha')
  fi
elif [[ -z "${SHA:-}" ]]; then
  echo "::error::Merged pull request payload did not include merge_commit_sha"
  exit 1
fi

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "::error::Commit must be a full 40-character SHA"
  exit 1
fi

if ! CONTAINMENT=$(gh api "repos/${GITHUB_REPOSITORY}/compare/${BRANCH}...${SHA}" --jq '.status'); then
  echo "::error::Failed to verify that commit ${SHA} belongs to ${BRANCH}"
  exit 1
fi
if [[ "$CONTAINMENT" != "behind" && "$CONTAINMENT" != "identical" ]]; then
  echo "::error::Commit ${SHA} is not contained in ${BRANCH} (compare status: ${CONTAINMENT})"
  exit 1
fi

VERSION=$(gh api "repos/${GITHUB_REPOSITORY}/contents/package.json?ref=${SHA}" \
  -H 'Accept: application/vnd.github.raw+json' | jq -r '.version')
if [[ ! "$VERSION" =~ ^${MAJOR}\.${MINOR}\.([0-9]+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  echo "::error::Package version does not match the selected cloud branch"
  exit 1
fi

TAG="cloud/v${VERSION}"

read_tag_object() {
  local error_file output
  error_file=$(mktemp)
  if output=$(gh api "repos/${GITHUB_REPOSITORY}/git/ref/tags/${TAG}" \
    --jq '[.object.type, .object.sha] | @tsv' \
    2>"$error_file"); then
    cat "$error_file" >&2
    rm -f "$error_file"
    printf '%s\n' "$output"
    return 0
  fi
  if grep -Eq 'HTTP 404' "$error_file"; then
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
    peeled=$(gh api "repos/${GITHUB_REPOSITORY}/git/tags/${object_sha}" \
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
    if ! existing_containment=$(gh api "repos/${GITHUB_REPOSITORY}/compare/${BRANCH}...${existing_commit}" --jq '.status'); then
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

if ! gh api --method POST "repos/${GITHUB_REPOSITORY}/git/refs" \
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
