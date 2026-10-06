#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="${1:-comfyui-ci-container:candidate}"

test -f "$repo_root/dist/index.html" || {
  echo 'Build the checkout frontend into dist/ before validating the image.' >&2
  exit 1
}

docker run --rm --init --pull never --network none --shm-size=2g -i \
  --mount "type=bind,src=$repo_root,dst=/workspace,readonly" \
  --workdir /workspace \
  --env CI=true \
  --env PLAYWRIGHT_TEST_URL=http://127.0.0.1:8188 \
  --env PLAYWRIGHT_SETUP_API_URL=http://127.0.0.1:8188 \
  "$image" bash -euo pipefail -s <<'BASH'
test "$(id -un)" = pwuser
test -w /ComfyUI
test -w /opt/venv
test -w /app

image_playwright=$(python3 -c 'import json; print(json.load(open("/ms-playwright/.docker-info"))["driverVersion"])')
actual_playwright=$(node -p 'require("@playwright/test/package.json").version')
if [[ "$actual_playwright" != "$image_playwright" ]]; then
  echo "Playwright mismatch: image=$image_playwright, installed=$actual_playwright" >&2
  exit 1
fi

node --version
python3 --version
python3 -c 'from importlib.metadata import distributions; print("\n".join(sorted(f"{d.name}=={d.version}" for d in distributions())))'
cp -R tools/devtools/. /ComfyUI/custom_nodes/ComfyUI_devtools/
python3 /ComfyUI/main.py --cpu --multi-user --front-end-root /workspace/dist \
  >/tmp/comfyui.log 2>&1 &
trap 'cat /tmp/comfyui.log >&2' ERR
wait-for-it --service 127.0.0.1:8188 -t 120
curl --fail --silent --show-error http://127.0.0.1:8188/ -o /tmp/frontend.html
cmp dist/index.html /tmp/frontend.html
curl --fail --silent --show-error \
  http://127.0.0.1:8188/api/devtools/fake_model.safetensors -o /tmp/fake_model.safetensors
cmp tools/devtools/fake_model.safetensors /tmp/fake_model.safetensors

node node_modules/@playwright/test/cli.js test \
  browser_tests/tests/infrastructure/setupApiUrl.spec.ts \
  --project chromium --workers 1 --retries 0 --reporter line --output /tmp/test-results
BASH
