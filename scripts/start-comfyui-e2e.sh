#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image=ghcr.io/comfy-org/comfyui-ci-container:0.0.22
version="${image##*:}"
fallback_image="comfyui-ci-container-local:$version"
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

if ! "${docker[@]}" image inspect "$image" >/dev/null 2>&1; then
  token="${COMFY_CI_CONTAINER_TOKEN:-${GH_TOKEN:-}}"
  username="${COMFY_CI_CONTAINER_USER:-}"
  if [[ -n "$token" && -z "$username" ]] && command -v gh >/dev/null 2>&1; then
    username="$(GH_TOKEN="$token" gh api user --jq .login 2>/dev/null || true)"
  fi

  if [[ -n "$token" && -n "$username" ]]; then
    echo "Pulling $image with configured GHCR credentials"
    if printf '%s' "$token" | "${docker[@]}" --config "$docker_config" \
      login ghcr.io --username "$username" --password-stdin; then
      if ! "${docker[@]}" --config "$docker_config" pull "$image"; then
        echo 'The private image pull failed; falling back to a source build.' >&2
      fi
    else
      echo 'GHCR rejected the configured credentials; falling back to a source build.' >&2
    fi
  elif [[ -z "$token" ]]; then
    echo 'GHCR credentials are not configured; skipping the private image pull.'
    echo 'Set GH_TOKEN or COMFY_CI_CONTAINER_TOKEN to enable it.'
  else
    echo 'Could not derive the GitHub username; skipping the private image pull.'
    echo 'Set COMFY_CI_CONTAINER_USER to enable it.'
  fi

  if ! "${docker[@]}" image inspect "$image" >/dev/null 2>&1; then
    if ! "${docker[@]}" image inspect "$fallback_image" >/dev/null 2>&1; then
      echo "Building $fallback_image from public source"
      "${docker[@]}" build --tag "$fallback_image" \
        "https://github.com/Comfy-Org/comfyui-ci-container.git#v$version"
    fi
    echo "Using source-built fallback $fallback_image; it may differ from the published CI image." >&2
    image="$fallback_image"
  fi
else
  echo "Using cached image $image"
fi

# Serving your own build is the only way a pack's web script reaches the page:
# the dev server answers /api/extensions with an empty list, so port 5173 loads
# no pack at all.
frontend_mount=()
frontend_args=()
if [[ -n "${COMFYUI_FRONTEND_ROOT:-}" ]]; then
  if [[ ! -d "$COMFYUI_FRONTEND_ROOT" ]]; then
    echo "COMFYUI_FRONTEND_ROOT is not a directory: $COMFYUI_FRONTEND_ROOT" >&2
    exit 1
  fi
  frontend_mount=(--mount
    "type=bind,src=$COMFYUI_FRONTEND_ROOT,dst=/frontend-dist,readonly")
  frontend_args=(--front-end-root /frontend-dist)
fi

"${docker[@]}" run --rm --name "$container" \
  --publish "127.0.0.1:$port:8188" \
  "${frontend_mount[@]}" \
  --mount \
  "type=bind,src=$repo_root/tools/devtools,dst=/ComfyUI/custom_nodes/ComfyUI_devtools,readonly" \
  --mount \
  "type=bind,src=$repo_root/examples/node-api/how_to_frontend_nodes,dst=/ComfyUI/custom_nodes/how_to_frontend_nodes,readonly" \
  --mount \
  "type=bind,src=$repo_root/examples/node-api/how_to_widgets,dst=/ComfyUI/custom_nodes/how_to_widgets,readonly" \
  --mount \
  "type=bind,src=$repo_root/examples/node-api/how_to_graph_interaction,dst=/ComfyUI/custom_nodes/how_to_graph_interaction,readonly" \
  --mount \
  "type=bind,src=$repo_root/examples/node-api/how_to_execution,dst=/ComfyUI/custom_nodes/how_to_execution,readonly" \
  "$image" \
  bash -lc \
  "cd /ComfyUI && exec python3 main.py --cpu --multi-user --listen 0.0.0.0 ${frontend_args[*]}"
