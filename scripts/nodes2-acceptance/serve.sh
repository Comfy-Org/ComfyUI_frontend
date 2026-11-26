#!/usr/bin/env bash
set -euo pipefail

usage='usage: serve.sh <port> <backend dir> <frontend build dir> [custom node directory...]'
[[ $# -ge 3 ]] || { echo "$usage" >&2; exit 2; }
port=$1 backend=$2 frontend=$3
shift 3

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${COMFYUI_DIR:?Set COMFYUI_DIR to a ComfyUI checkout}"
python="${COMFYUI_PYTHON:-$COMFYUI_DIR/.venv/bin/python}"
backend="$(mkdir -p "$backend" && cd "$backend" && pwd)"
frontend="$(cd "$frontend" && pwd)"

command -v lsof >/dev/null || { echo 'lsof is required to verify listener ownership' >&2; exit 1; }
if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t >/dev/null; then
  echo "Port $port already has a listener" >&2
  exit 1
fi
if [[ -f $backend/server.pid ]] && kill -0 "$(cat "$backend/server.pid")" 2>/dev/null; then
  echo "Backend $backend already has a live server.pid" >&2
  exit 1
fi

mkdir -p "$backend"/{custom_nodes,input,output,temp,user}
rm -rf "$backend/custom_nodes/ComfyUI_devtools"
cp -R "$repo_root/tools/devtools" "$backend/custom_nodes/ComfyUI_devtools"

overlay=""
[[ -d $backend/python-overlay ]] && overlay="$backend/python-overlay"

server_pid=""
trap '
  if [[ -n $server_pid ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
    rm -f "$backend/server.pid"
  fi
' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(
  cd "$COMFYUI_DIR"
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$overlay" exec "$python" main.py \
    --cpu --multi-user --disable-auto-launch --disable-api-nodes \
    --disable-all-custom-nodes --whitelist-custom-nodes ComfyUI_devtools "$@" \
    --listen 127.0.0.1 --port "$port" \
    --base-directory "$backend" --user-directory "$backend/user" \
    --input-directory "$backend/input" --output-directory "$backend/output" \
    --temp-directory "$backend/temp" \
    --database-url "sqlite:///$backend/user/comfy.db" \
    --front-end-root "$frontend"
) >"$backend/server.log" 2>&1 </dev/null &
server_pid=$!
echo "$server_pid" >"$backend/server.pid"

for _ in $(seq 1 90); do
  kill -0 "$server_pid" 2>/dev/null || break
  if lsof -nP -a -p "$server_pid" -iTCP:"$port" -sTCP:LISTEN -t >/dev/null &&
    curl -fsS -m 2 "http://127.0.0.1:$port/api/system_stats" >/dev/null &&
    kill -0 "$server_pid" 2>/dev/null; then
    trap - EXIT
    exit 0
  fi
  sleep 2
done
echo "ComfyUI on port $port did not start; see $backend/server.log" >&2
exit 1
