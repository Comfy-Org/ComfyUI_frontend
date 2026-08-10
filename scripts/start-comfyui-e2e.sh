#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image=ghcr.io/comfy-org/comfyui-ci-container:0.0.21
port="${COMFYUI_PORT:-8188}"
container=comfyui-e2e
docker=(docker)

if [[ "${AMP_ORB:-}" == 1 ]]; then
  docker=(sudo docker)
  until "${docker[@]}" info >/dev/null 2>&1; do sleep 1; done
elif ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    docker=(sudo docker)
  else
    echo 'Docker is not running. Start Docker and try again.' >&2
    exit 1
  fi
fi

docker_config="$(mktemp -d)"
cleanup() {
  "${docker[@]}" rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$docker_config"
}
trap cleanup EXIT

if ! "${docker[@]}" image inspect "$image" >/dev/null 2>&1 &&
  ! "${docker[@]}" pull "$image"; then
  token="${COMFY_CI_CONTAINER_TOKEN:-}"
  if [[ -z "$token" ]] && command -v gh >/dev/null 2>&1; then
    token="$(gh auth token 2>/dev/null || true)"
  fi

  username="${COMFY_CI_CONTAINER_USER:-}"
  if [[ -z "$username" ]] && command -v gh >/dev/null 2>&1; then
    username="$(gh api user --jq .login 2>/dev/null || true)"
  fi

  if [[ -n "$token" && -n "$username" ]]; then
    printf '%s' "$token" | "${docker[@]}" --config "$docker_config" \
      login ghcr.io --username "$username" --password-stdin
  fi

  if ! "${docker[@]}" --config "$docker_config" pull "$image"; then
    "${docker[@]}" build --tag "$image" \
      'https://github.com/Comfy-Org/comfyui-ci-container.git#v0.0.21'
  fi
fi

"${docker[@]}" rm -f "$container" >/dev/null 2>&1 || true
"${docker[@]}" run --rm --name "$container" \
  --publish "127.0.0.1:$port:8188" \
  --mount \
  "type=bind,src=$repo_root/tools/devtools,dst=/ComfyUI/custom_nodes/ComfyUI_devtools,readonly" \
  "$image" \
  bash -lc \
  'cd /ComfyUI && exec python3 main.py --cpu --multi-user --listen 0.0.0.0'
