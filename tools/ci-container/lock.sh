#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
commit=$(sed -n 's/^ARG COMFYUI_COMMIT=//p' Dockerfile)
input=$(mktemp)
trap 'rm -f "$input"' EXIT
curl --fail --silent --show-error --max-time 60 \
  "https://raw.githubusercontent.com/Comfy-Org/ComfyUI/$commit/requirements.txt" > "$input"
printf '\nwait-for-it==2.3.0\n' >> "$input"
uv pip compile "$input" --python-version 3.12 \
  --python-platform x86_64-unknown-linux-gnu --torch-backend cpu \
  --only-binary :all: --generate-hashes --no-annotate --no-header \
  --output-file requirements.lock "$@"
