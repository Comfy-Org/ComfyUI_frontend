#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

mapfile -t workflow_references < <(
  git grep -h -E \
    '^[[:space:]]*image:.*ghcr.io/comfy-org/comfyui-ci-container' \
    -- '.github/workflows/*.yaml' '.github/workflows/*.yml' |
    sed -E \
      "s|^[[:space:]]*image:[[:space:]]*['\"]?([^'\"[:space:]#]+)['\"]?[[:space:]]*(#.*)?$|\1|"
)
mapfile -t script_references < <(
  sed -n -E \
    's|^image=(ghcr.io/comfy-org/comfyui-ci-container:[^[:space:]#]+)$|\1|p' \
    scripts/start-comfyui-e2e.sh
)

if [[ ${#workflow_references[@]} -eq 0 || ${#script_references[@]} -ne 1 ]]; then
  echo 'Expected container references in workflows and the launcher.' >&2
  exit 1
fi

references=("${workflow_references[@]}" "${script_references[@]}")
for reference in "${references[@]}"; do
  if [[ ! "$reference" =~ ^ghcr\.io/comfy-org/comfyui-ci-container:[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid ComfyUI CI container reference: $reference" >&2
    exit 1
  fi
done

mapfile -t versions < <(printf '%s\n' "${references[@]##*:}" | sort -u)

if [[ ${#versions[@]} -ne 1 ]]; then
  echo 'ComfyUI CI container references must use one version.' >&2
  printf 'Found: %s\n' "${versions[*]:-none}" >&2
  exit 1
fi

echo "ComfyUI CI container references use ${versions[0]}"
