#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

mapfile -t versions < <(
  git grep -h -o \
    'ghcr.io/comfy-org/comfyui-ci-container:[0-9][0-9.]*' \
    -- '.github/workflows/*.yaml' scripts/start-comfyui-e2e.sh |
    sed 's/.*://' |
    sort -u
)

if [[ ${#versions[@]} -ne 1 ]]; then
  echo 'ComfyUI CI container references must use one version.' >&2
  printf 'Found: %s\n' "${versions[*]:-none}" >&2
  exit 1
fi

echo "ComfyUI CI container references use ${versions[0]}"
