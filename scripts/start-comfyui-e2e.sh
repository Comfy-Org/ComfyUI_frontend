#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image=ghcr.io/comfy-org/comfyui-ci-container:0.0.21
version="${image##*:}"
port="${COMFYUI_PORT:-8188}"
container="comfyui-e2e-$$"
docker=(docker)

if [[ "${AMP_ORB:-}" == 1 ]]; then
  docker=(sudo docker)
  for _ in {1..60}; do
    timeout 5 "${docker[@]}" info >/dev/null 2>&1 && break
    sleep 1
  done
  if ! timeout 5 "${docker[@]}" info >/dev/null 2>&1; then
    echo 'Docker did not become ready within 60 seconds.' >&2
    exit 1
  fi
elif ! docker info >/dev/null 2>&1; then
  if [[ "$(uname -s)" == Linux ]] && sudo -n docker info >/dev/null 2>&1; then
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
    if ! printf '%s' "$token" | "${docker[@]}" --config "$docker_config" \
      login ghcr.io --username "$username" --password-stdin; then
      echo 'GHCR login failed; building from public source.' >&2
    fi
  fi

  if ! "${docker[@]}" --config "$docker_config" pull "$image"; then
    "${docker[@]}" build --tag "$image" \
      "https://github.com/Comfy-Org/comfyui-ci-container.git#v$version"
  fi
fi

"${docker[@]}" run --rm --name "$container" \
  --publish "127.0.0.1:$port:8188" \
  --mount \
  "type=bind,src=$repo_root/tools/devtools,dst=/ComfyUI/custom_nodes/ComfyUI_devtools,readonly" \
  "$image" \
  bash -lc \
  'cd /ComfyUI && exec python3 main.py --cpu --multi-user --listen 0.0.0.0'
