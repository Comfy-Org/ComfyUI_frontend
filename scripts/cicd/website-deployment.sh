#!/usr/bin/env bash
set -euo pipefail

readonly CANONICAL_HOST=comfy.org
readonly BUILD_IDENTITY_PATH=apps/website/public/__build.json

vercel_api() {
  curl -fsS --retry 3 \
    -H "Authorization: Bearer ${VERCEL_TOKEN:?VERCEL_TOKEN is required}" \
    "https://api.vercel.com/$1"
}

write_build_identity() {
  jq -n \
    --arg repository "${GITHUB_REPOSITORY:?}" \
    --arg sha "${1:?usage: write-build-identity <sha>}" \
    --arg runId "${GITHUB_RUN_ID:?}" \
    --arg runAttempt "${GITHUB_RUN_ATTEMPT:?}" \
    --arg builtAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{$repository, $sha, $runId, $runAttempt, $builtAt}' \
    >"$BUILD_IDENTITY_PATH"
}

alias_deployment_id() {
  vercel_api "v4/aliases/$CANONICAL_HOST?projectId=${VERCEL_PROJECT_ID:?}&teamId=${VERCEL_ORG_ID:?}" |
    jq -er '.deploymentId'
}

deployment_field() {
  local ref=${1:?usage: deployment <id-or-host> <field>}
  local field=${2:?usage: deployment <id-or-host> <field>}
  vercel_api "v13/deployments/$ref?teamId=${VERCEL_ORG_ID:?}" |
    jq -er --arg ref "$ref" --arg field "$field" --arg projectId "${VERCEL_PROJECT_ID:?}" \
      'select((.projectId // .project.id) == $projectId and (.id == $ref or ($ref | startswith("dpl_") | not))) | .[$field]'
}

host_of() {
  local host=${1#https://}
  printf '%s' "${host%/}"
}

build_identity() {
  curl -fsS -H 'Cache-Control: no-cache' \
    "https://$(host_of "$1")/__build.json?probe=${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-$2"
}

marker_sha() {
  build_identity "${1:?usage: marker-sha <host>}" 0 | jq -r '.sha // empty'
}

verify_identity() {
  local host='' sha='' deployment='' this_run=false attempts=1 interval=0
  while (($#)); do
    case $1 in
      --host) host=$2 ;;
      --sha) sha=$2 ;;
      --canonical-deployment) deployment=$2 host=$CANONICAL_HOST ;;
      --attempts) attempts=$2 ;;
      --interval) interval=$2 ;;
      --this-run) this_run=true && shift && continue ;;
      *) echo "unknown option: $1" >&2 && return 2 ;;
    esac
    shift 2
  done
  : "${host:?--host or --canonical-deployment is required}" "${sha:?--sha is required}"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if serves_identity "$attempt"; then return 0; fi
    if ((attempt < attempts)); then sleep "$interval"; fi
  done
  echo "::error::$(host_of "$host") did not serve $sha${deployment:+ from $deployment}"
  return 1
}

serves_identity() {
  local identity
  identity=$(build_identity "$host" "$1") || return 1
  jq -e \
    --arg sha "$sha" \
    --argjson thisRun "$this_run" \
    --arg runId "${GITHUB_RUN_ID:-}" \
    --arg runAttempt "${GITHUB_RUN_ATTEMPT:-}" \
    '.sha == $sha and (($thisRun | not) or (.runId == $runId and .runAttempt == $runAttempt))' \
    <<<"$identity" >/dev/null || return 1
  [[ -z $deployment ]] && return 0
  [[ $(alias_deployment_id || true) == "$deployment" ]] || return 1
  curl -fsS -o /dev/null "https://$CANONICAL_HOST/"
}

command=${1:?usage: website-deployment.sh <command> [args]}
shift
case $command in
  write-build-identity) write_build_identity "$@" ;;
  alias-deployment-id) alias_deployment_id ;;
  deployment) deployment_field "$@" ;;
  marker-sha) marker_sha "$@" ;;
  verify-identity) verify_identity "$@" ;;
  *) echo "unknown command: $command" >&2 && exit 2 ;;
esac
