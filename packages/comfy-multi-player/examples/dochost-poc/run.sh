#!/usr/bin/env bash
# Pack the exact checked-out applier, install it into a disposable copy of the
# real doc-host sidecar, start that copy on :8095, and run the no-mock POC driver.
#
# Usage:
#   DOCHOST_SRC=/path/to/cloud-main/services/agent/dochost ./examples/dochost-poc/run.sh
#
# DOCHOST_SRC must point at services/agent/dochost from Comfy-Org/cloud main.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-8095}"
DOCHOST_SRC="${DOCHOST_SRC:-$REPO_ROOT/../../../cloud/services/agent/dochost}"
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/cmp-dochost.XXXXXX")"
DOCHOST_STAGE="$STAGE_ROOT/dochost"
ARTIFACTS="$STAGE_ROOT/artifacts"
SIDECAR=""

cleanup() {
  if [ -n "$SIDECAR" ]; then
    kill "$SIDECAR" 2>/dev/null || true
    wait "$SIDECAR" 2>/dev/null || true
  fi
  rm -rf "$STAGE_ROOT"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

echo "== 1/4 build and pack applier ($REPO_ROOT) =="
mkdir -p "$ARTIFACTS" "$DOCHOST_STAGE"
( cd "$REPO_ROOT" && pnpm run build && pnpm pack --config.ignore-scripts=true --json --pack-destination "$ARTIFACTS" > "$ARTIFACTS/pack.json" )
TARBALL="$(node -e 'const fs=require("node:fs"); const path=require("node:path"); const result=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const file=result?.filename; if(Array.isArray(result) || typeof file !== "string" || !path.isAbsolute(file) || fs.realpathSync(path.dirname(file)) !== fs.realpathSync(process.argv[2])) { console.error("pnpm pack did not report one tarball inside the artifact directory"); process.exit(1); } process.stdout.write(file)' "$ARTIFACTS/pack.json" "$ARTIFACTS")"
echo "artifact sha256: $(sha256sum "$TARBALL" | cut -d' ' -f1)"
mkdir -p "$ARTIFACTS/unpacked"
tar -xzf "$TARBALL" -C "$ARTIFACTS/unpacked"

echo "== 2/4 stage and build doc-host sidecar ($DOCHOST_SRC) =="
tar -C "$DOCHOST_SRC" --exclude='./node_modules' --exclude='./dist' --exclude='./.git' -cf - . | tar -C "$DOCHOST_STAGE" -xf -
( cd "$DOCHOST_STAGE" && npm ci && npm install --no-save "$TARBALL" && npm run build )
node "$REPO_ROOT/examples/dochost-poc/verify-package-identity.mjs" "$ARTIFACTS/unpacked/package" "$DOCHOST_STAGE"
( cd "$DOCHOST_STAGE" && node --input-type=module - <<'NODE'
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
const stage = realpathSync(process.cwd());
const fromHost = createRequire(join(stage, "package.json"));
const cmpRoot = realpathSync(join(stage, "node_modules/@comfyorg/comfy-multi-player"));
const fromCmp = createRequire(join(cmpRoot, "package.json"));
// The real package exports an import condition only, just like the ESM server.
const cmpEntry = realpathSync(fileURLToPath(import.meta.resolve("@comfyorg/comfy-multi-player")));
if (!cmpEntry.startsWith(`${cmpRoot}${sep}`)) throw new Error("staged module resolver escaped installed CMP");
const hostYjs = realpathSync(fromHost.resolve("yjs"));
const cmpYjs = realpathSync(fromCmp.resolve("yjs"));
if (hostYjs !== cmpYjs) throw new Error(`doc-host and CMP resolve different Yjs copies: ${hostYjs} != ${cmpYjs}`);
NODE
)

echo "== 3/4 start sidecar on :$PORT =="
if curl -sf --connect-timeout 0.1 --max-time 0.2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "refusing to reuse an existing healthy service on :$PORT" >&2
  exit 1
fi
( cd "$DOCHOST_STAGE" && exec env PORT="$PORT" node dist/server.js ) &
SIDECAR=$!
ready=0
for _ in $(seq 1 30); do
  if ! kill -0 "$SIDECAR" 2>/dev/null; then
    wait "$SIDECAR" || true
    echo "sidecar exited before becoming healthy on :$PORT" >&2
    exit 1
  fi
  if curl -sf --connect-timeout 0.1 --max-time 0.2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && kill -0 "$SIDECAR" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 0.3
done
if [ "$ready" -ne 1 ]; then
  echo "sidecar did not become healthy on :$PORT within 15s" >&2
  exit 1
fi

echo "== 4/4 drive it =="
DOC_HOST="http://127.0.0.1:$PORT" CMP_PIN="$REPO_ROOT" \
  node "$REPO_ROOT/examples/dochost-poc/dochost-driver.mjs"
