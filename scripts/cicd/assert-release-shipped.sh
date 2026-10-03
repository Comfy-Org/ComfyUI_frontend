#!/usr/bin/env bash
set -euo pipefail

: "${PACKAGE:?PACKAGE is required}"
: "${TARGET_VERSION:?TARGET_VERSION is required}"
: "${TARGET_BRANCH:?TARGET_BRANCH is required}"

readonly TAG="v${TARGET_VERSION}"
failed=0

summary() {
  [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && printf '%s\n' "$@" >>"$GITHUB_STEP_SUMMARY"
  return 0
}

fail() {
  echo "::error title=$1::$2"
  summary "- FAIL: $2"
  failed=1
}

assert_nothing_stranded_past_the_tag() {
  if ! git fetch --quiet --tags origin "$TARGET_BRANCH"; then
    fail "Fetch failed" "Could not fetch ${TARGET_BRANCH} from origin."
    return
  fi
  if ! git rev-parse -q --verify "refs/tags/${TAG}^{commit}" >/dev/null; then
    fail "Release tag missing" "Tag ${TAG} not found."
    return
  fi

  local stranded
  stranded=$(git rev-list "${TAG}..FETCH_HEAD" --count) || stranded=""
  if [[ ! "$stranded" =~ ^[0-9]+$ ]]; then
    fail "Stranded count unavailable" "git rev-list failed or returned non-numeric output."
  elif ((stranded != 0)); then
    fail "Commits stranded past the release tag" \
      "${stranded} commit(s) on ${TARGET_BRANCH} are newer than ${TAG}; the published release does not contain them."
  else
    summary "- OK: no commits stranded past \`${TAG}\`"
  fi
}

assert_version_on_pypi() {
  local http_code
  http_code=$(curl -s --connect-timeout 10 --max-time 30 --retry 3 --retry-all-errors -o /dev/null -w '%{http_code}' \
    "https://pypi.org/pypi/${PACKAGE}/${TARGET_VERSION}/json") || http_code="000"
  if [[ "$http_code" == "200" ]]; then
    summary "- OK: PyPI has \`${PACKAGE}==${TARGET_VERSION}\`"
  else
    fail "Target version missing on PyPI" "${PACKAGE}==${TARGET_VERSION} returned HTTP ${http_code}."
  fi
}

# A core/* patch must not steal PyPI's `latest` from a higher minor.
assert_pypi_latest_only_for_main() {
  local pypi_latest
  pypi_latest=$(curl -sf --connect-timeout 10 --max-time 30 --retry 3 --retry-all-errors "https://pypi.org/pypi/${PACKAGE}/json" |
    jq -r '.info.version // empty') || pypi_latest=""

  if [[ -z "$pypi_latest" ]]; then
    fail "PyPI latest unavailable" "Failed to query the PyPI info endpoint for ${PACKAGE}."
  elif [[ "$TARGET_BRANCH" == "main" && "$pypi_latest" != "$TARGET_VERSION" ]]; then
    fail "PyPI latest mismatch" "PyPI latest is ${pypi_latest}, expected ${TARGET_VERSION}."
  else
    summary "- Info: PyPI \`latest\` = \`${pypi_latest}\` (target branch \`${TARGET_BRANCH}\`)"
  fi
}

summary "## Release-done assertion" "" "Target: \`${TAG}\` on \`${TARGET_BRANCH}\`" ""

assert_nothing_stranded_past_the_tag
assert_version_on_pypi
assert_pypi_latest_only_for_main

if ((failed != 0)); then
  echo "release-done assertion FAILED — see annotations above."
  exit 1
fi
echo "release-done assertion passed."
