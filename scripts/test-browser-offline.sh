#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
dist="$(realpath "${PLAYWRIGHT_OFFLINE_DIST:-$repo_root/dist}")"
image="${COMFYUI_TEST_IMAGE:-ghcr.io/comfy-org/comfyui-ci-container:0.0.22}"

test -f "$dist/index.html"
test -d "$repo_root/node_modules"

exec docker run --rm --pull never --network none --ipc host --user 0:0 \
  --mount "type=bind,src=$repo_root,dst=$repo_root" \
  --mount "type=bind,src=$dist,dst=/frontend,readonly" \
  --mount "type=bind,src=$repo_root/tools/devtools,dst=/ComfyUI/custom_nodes/ComfyUI_devtools,readonly" \
  --workdir "$repo_root" \
  --env CI=true \
  --env PLAYWRIGHT_TEST_URL=http://localhost:8188 \
  --env PLAYWRIGHT_SETUP_API_URL=http://localhost:8188 \
  "$image" bash -euc '
    python3 /ComfyUI/main.py --cpu --multi-user --front-end-root /frontend \
      >/tmp/comfyui.log 2>&1 &
    wait-for-it --service 127.0.0.1:8188 -t 120 || {
      cat /tmp/comfyui.log
      exit 1
    }
    node node_modules/@playwright/test/cli.js test --retries=0 "$@"
  ' bash "$@"
