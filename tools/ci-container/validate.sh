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
  --env PYTHONOPTIMIZE=0 \
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

test ! -w "$(command -v node)"
node --version
node <<'JS'
const assert = require('node:assert/strict')
const { satisfies } = require('semver')
const { engines } = require('./package.json')
assert(satisfies(process.versions.node, engines.node),
  `Node ${process.versions.node} does not satisfy ${engines.node}`)
JS
corepack --version
python3 --version
python3 -c 'from importlib.metadata import distributions; print("\n".join(sorted(f"{d.name}=={d.version}" for d in distributions())))'

mkdir -p /tmp/default-frontend/custom_nodes
python3 /ComfyUI/main.py --cpu --port 8189 --base-directory /tmp/default-frontend \
  >/tmp/default-frontend.log 2>&1 &
default_frontend_pid=$!
trap 'cat /tmp/default-frontend.log >&2' ERR
wait-for-it --service 127.0.0.1:8189 -t 120
curl --fail --silent --show-error --max-time 30 http://127.0.0.1:8189/ -o /tmp/default-frontend.html
cmp /opt/venv/lib/python3.12/site-packages/comfyui_frontend_package/static/index.html \
  /tmp/default-frontend.html
kill "$default_frontend_pid"
wait "$default_frontend_pid" || test "$?" -eq 143

cp -R tools/devtools/. /ComfyUI/custom_nodes/ComfyUI_devtools/
python3 /ComfyUI/main.py --cpu --multi-user --front-end-root /workspace/dist \
  >/tmp/comfyui.log 2>&1 &
trap 'cat /tmp/comfyui.log >&2' ERR
wait-for-it --service 127.0.0.1:8188 -t 120
curl --fail --silent --show-error --max-time 30 http://127.0.0.1:8188/ -o /tmp/frontend.html
cmp dist/index.html /tmp/frontend.html
curl --fail --silent --show-error --max-time 30 \
  http://127.0.0.1:8188/api/devtools/fake_model.safetensors -o /tmp/fake_model.safetensors
cmp tools/devtools/fake_model.safetensors /tmp/fake_model.safetensors

python3 - <<'PY'
import json
from importlib.resources import files
from pathlib import Path
from urllib.request import urlopen

import comfy_kitchen
import torch
from comfyui_workflow_templates_core import iter_assets

assert torch.version.cuda is None and torch.version.hip is None
values = torch.tensor([[-3.0, 0.5, 2.0]])
quantized, scale = comfy_kitchen.quantize_int8_tensorwise(values, scale=0.5)
torch.testing.assert_close(quantized, torch.tensor([[-6, 1, 4]], dtype=torch.int8))
torch.testing.assert_close(comfy_kitchen.dequantize_int8_simple(quantized, scale), values)
print('CPU kitchen quantization and dequantization passed')

with urlopen('http://127.0.0.1:8188/object_info', timeout=30) as response:
    nodes = json.load(response)
assert {'KSampler', 'SaveImage', 'EmptyImage'} <= nodes.keys()

assets = {}
for filename, path in iter_assets():
    assets.setdefault(Path(path).parent, (f'/templates/{filename}', Path(path)))
assert assets, 'No workflow template assets found'
docs = files('comfyui_embedded_docs') / 'docs/KSampler/en.md'
for route, path in [*assets.values(), ('/docs/KSampler/en.md', docs)]:
    with urlopen(f'http://127.0.0.1:8188{route}', timeout=30) as response:
        assert response.read() == path.read_bytes(), route
    print(f'Asset bytes matched: {route}')
PY

node --input-type=module <<'JS'
import assert from 'node:assert/strict'
import { firefox, webkit } from '@playwright/test'

for (const browserType of [firefox, webkit]) {
  const browser = await browserType.launch()
  try {
    const page = await browser.newPage()
    const response = await page.goto('http://127.0.0.1:8188/')
    assert.equal(response.status(), 200)
    assert.equal(await page.title(), 'ComfyUI')
    console.log(`${browserType.name()} served frontend successfully`)
  } finally {
    await browser.close()
  }
}
JS

cd /app
node /workspace/node_modules/@playwright/test/cli.js test \
  --config /workspace/playwright.config.ts \
  browser_tests/tests/infrastructure/setupApiUrl.spec.ts \
  --project chromium --workers 1 --retries 0 --reporter line --output /tmp/test-results
BASH
