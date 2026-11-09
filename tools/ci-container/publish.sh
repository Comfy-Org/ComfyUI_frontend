#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
image=ghcr.io/comfy-org/comfyui-ci-container
source=https://github.com/Comfy-Org/ComfyUI_frontend
package=orgs/Comfy-Org/packages/container/comfyui-ci-container/versions
old_workflow=repos/Comfy-Org/comfyui-ci-container/actions/workflows/build-and-push.yml
version=$(cat tools/ci-container/VERSION)
revision=$(git rev-parse HEAD)
tag="ci-container/v$version"
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

fail() { echo "$*" >&2; exit 1; }
published_digest() {
  local token status result
  token=$(curl --fail --silent --show-error --max-time 60 --user "$GITHUB_ACTOR:$GH_TOKEN" \
    'https://ghcr.io/token?service=ghcr.io&scope=repository:comfy-org/comfyui-ci-container:pull' |
    jq -er .token) || return
  status=$(curl --silent --show-error --max-time 60 --head --dump-header "$headers" \
    --output /dev/null --write-out '%{http_code}' --header "Authorization: Bearer $token" \
    --header 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/comfy-org/comfyui-ci-container/manifests/$version") || return
  case "$status" in
    200)
      result=$(awk 'tolower($1) == "docker-content-digest:" {gsub(/\r/, "", $2); print $2}' "$headers")
      [[ "$result" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'Invalid registry digest'
      echo "$result" ;;
    404) ;;
    *) fail "Registry lookup failed: HTTP $status" ;;
  esac
}

[[ "$version" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || fail 'VERSION must be canonical major.minor.patch'
git merge-base --is-ancestor "$revision" origin/main || fail 'Release must come from main'
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail 'Release checkout must be clean'

state=$(gh api "$old_workflow" --jq .state)
[[ "$state" == disabled_manually ]] || fail 'Disable the old publisher before enabling this one'
runs=$(gh api --paginate --slurp "$old_workflow/runs?per_page=100")
jq -e 'all(.[].workflow_runs[]; .status == "completed")' <<< "$runs" >/dev/null || fail 'Wait for old publisher runs to finish'

versions=$(gh api --paginate --slurp "$package?per_page=100")
remote_tags=$(git ls-remote --tags origin 'refs/tags/ci-container/v*')
latest=$({
  jq -r '.[][] | .metadata.container.tags[]' <<< "$versions"
  awk '{sub(/^refs\/tags\/ci-container\/v/, "", $2); print $2}' <<< "$remote_tags"
} | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n 1)
[[ "$(printf '%s\n' "$latest" "$version" | sort -V | tail -n 1)" == "$version" ]] || fail 'Refusing to release an older version'
digest=$(published_digest)

remote_tag=$(awk -v tag="refs/tags/$tag" '$2 == tag {print $1}' <<< "$remote_tags")
if [[ -n "$remote_tag" ]]; then
  git fetch origin "refs/tags/$tag:refs/tags/$tag"
  [[ "$(git rev-parse "$tag^{commit}")" == "$revision" ]] || fail 'Source tag belongs to another revision'
  [[ -n "$digest" ]] || fail 'Source tag exists but its image is missing; do not rebuild'
  [[ "$(git for-each-ref --format='%(contents)' "refs/tags/$tag")" == "$image@$digest" ]] || fail 'Source tag records another digest'
fi

if [[ -z "$digest" ]]; then
  docker build --platform linux/amd64 --tag "$image:$version" \
    --label "org.opencontainers.image.source=$source" \
    --label "org.opencontainers.image.revision=$revision" \
    --label "org.opencontainers.image.version=$version" tools/ci-container
  bash tools/ci-container/validate.sh "$image:$version"
  docker push "$image:$version"
  digest=$(published_digest)
  [[ -n "$digest" ]] || fail 'Published version is not yet visible; inspect the registry before rerunning'
fi

docker pull "$image@$digest"
metadata=$(docker image inspect "$image@$digest")
jq -e --arg source "$source" --arg revision "$revision" --arg version "$version" '
  .[0] | .Os == "linux" and .Architecture == "amd64" and
  (.Config.Labels | .["org.opencontainers.image.source"] == $source and
    .["org.opencontainers.image.revision"] == $revision and
    .["org.opencontainers.image.version"] == $version)
' <<< "$metadata" >/dev/null || fail 'Published image does not match the release source'
bash tools/ci-container/validate.sh "$image@$digest"

if [[ -z "$remote_tag" ]]; then
  git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
    tag -a "$tag" "$revision" -m "$image@$digest"
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin "refs/tags/$tag"
fi

IFS=. read -r major minor _ <<< "$version"
backend=$(sed -n 's/^ARG COMFYUI_VERSION=//p' tools/ci-container/Dockerfile)
playwright=$(sed -n 's|^FROM mcr.microsoft.com/playwright:\(.*\)-noble$|\1|p' tools/ci-container/Dockerfile)
for alias in main latest "$major" "$major.$minor" "comfyui-$backend" "playwright-$playwright"; do
  docker buildx imagetools create --prefer-index=false --tag "$image:$alias" "$image@$digest"
done
printf 'Published %s:%s at %s (source %s)\n' "$image" "$version" "$digest" "$revision" |
  tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
