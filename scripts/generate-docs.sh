#!/usr/bin/env bash
# PKG5.D6 — Generate TypeDoc → Mintlify MDX for @comfyorg/extension-api
#
# Output: packages/extension-api/docs-build/mintlify/*.mdx
#         packages/extension-api/docs-build/mintlify/nav-snippet.json
#
# Prerequisites: pnpm install must have been run (typedoc, tsx)
# Usage: ./scripts/generate-docs.sh [--watch]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$REPO_ROOT/packages/extension-api"

if [ ! -f "$PKG_DIR/package.json" ]; then
  echo "ERROR: $PKG_DIR/package.json not found — run from repo root or ensure packages/extension-api exists." >&2
  exit 1
fi

if [ "${1:-}" = "--watch" ]; then
  echo "Starting docs watch mode..."
  pnpm --filter @comfyorg/extension-api docs:watch
else
  echo "Generating extension API docs..."
  pnpm --filter @comfyorg/extension-api docs:build
  echo ""
  echo "Done. MDX files written to: $PKG_DIR/docs-build/mintlify/"
  echo "Copy to Comfy-Org/docs: cp -r $PKG_DIR/docs-build/mintlify/* <docs-repo>/extensions/api/"
fi
