#!/usr/bin/env bash
# Reports `confirmed` rather than failing: a slow index must annotate the pin PR, not skip it.
set -euo pipefail

: "${PACKAGE:?PACKAGE is required}"
: "${TARGET_VERSION:?TARGET_VERSION is required}"

timeout_seconds=${TIMEOUT_SECONDS:-900}
poll_seconds=${POLL_SECONDS:-20}
readonly DIST_NAME="${PACKAGE//-/_}"

installable() {
  curl -sf --connect-timeout 10 --max-time 20 \
    "https://pypi.org/pypi/${PACKAGE}/${TARGET_VERSION}/json" -o /dev/null || return 1
  # pip resolves against the simple index, which lags the JSON API.
  curl -sf --connect-timeout 10 --max-time 20 "https://pypi.org/simple/${PACKAGE}/" |
    grep -qF "${DIST_NAME}-${TARGET_VERSION}" || return 1
}

echo "Waiting up to $((timeout_seconds / 60))m for ${PACKAGE}==${TARGET_VERSION}..."

deadline=$((SECONDS + timeout_seconds))
while ((SECONDS < deadline)); do
  if installable; then
    echo "${PACKAGE}==${TARGET_VERSION} is installable."
    echo "confirmed=true" >>"${GITHUB_OUTPUT:-/dev/null}"
    exit 0
  fi
  remaining=$((deadline - SECONDS))
  ((remaining > 0)) || break
  sleep "$((remaining < poll_seconds ? remaining : poll_seconds))"
done

echo "::warning::${PACKAGE}==${TARGET_VERSION} still not installable after $((timeout_seconds / 60))m."
echo "confirmed=false" >>"${GITHUB_OUTPUT:-/dev/null}"
