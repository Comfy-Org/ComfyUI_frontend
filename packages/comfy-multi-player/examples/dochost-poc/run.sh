#!/usr/bin/env bash
# Build the applier (this repo) + the real doc-host sidecar (from a cloud checkout),
# start the sidecar on :8095, and run the no-mock POC driver. No mocks, no /tmp state.
#
# Usage:
#   DOCHOST_SRC=/path/to/cloud-main/services/agent/dochost ./examples/dochost-poc/run.sh
#
# DOCHOST_SRC must point at services/agent/dochost from Comfy-Org/cloud main.
# Its `npm ci` pulls the published @comfyorg/comfy-multi-player@0.1.0 applier.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-8095}"
DOCHOST_SRC="${DOCHOST_SRC:-$REPO_ROOT/../cloud/services/agent/dochost}"

echo "== 1/4 build applier ($REPO_ROOT) =="
( cd "$REPO_ROOT" && npm ci && npm run build )

echo "== 2/4 build doc-host sidecar ($DOCHOST_SRC) =="
( cd "$DOCHOST_SRC" && npm ci && npm run build )
# One Yjs instance only: a nested copy breaks Yjs instanceof checks and makes
# project() throw "could not be cloned". npm ci dedupes; belt-and-suspenders:
rm -rf "$DOCHOST_SRC/node_modules/@comfyorg/comfy-multi-player/node_modules/yjs" 2>/dev/null || true

echo "== 3/4 start sidecar on :$PORT =="
( cd "$DOCHOST_SRC" && PORT="$PORT" node dist/server.js ) &
SIDECAR=$!
trap 'kill "$SIDECAR" 2>/dev/null || true' EXIT
ready=0
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.3
done
if [ "$ready" -ne 1 ]; then
  echo "sidecar did not become healthy on :$PORT within 9s" >&2
  exit 1
fi

echo "== 4/4 drive it =="
DOC_HOST="http://127.0.0.1:$PORT" CMP_PIN="$REPO_ROOT" \
  node "$REPO_ROOT/examples/dochost-poc/dochost-driver.mjs"
