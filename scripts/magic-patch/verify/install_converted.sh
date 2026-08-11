#!/bin/sh
# Installs a converted pack into the local ComfyUI for hands-on testing.
#
#   sh temp/scripts/install_converted.sh <db-pack-name> [...]
#
# Clones the upstream pack (its Python is what registers the node types — the
# converted JS has nothing to attach to without it), then overlays our
# converted JS over the pack's own web files.
#
# The syntax gate copies each file to .mjs before checking. `node --check x.js`
# is a FALSE PASS on ESM: node retries the parse as ESM and exits 0 on a
# syntactically broken file.
set -e
cd "$(dirname "$0")/../../.."
REPO_ROOT=$(pwd)
COMFY=/Users/ben/comfy/ComfyUI
REG=/Users/ben/comfy/nodes-compat-study/data/registry.json

for pack in "$@"; do
  echo "=== $pack ==="
  url=$(python3 -c "
import json,sys
for r in json.load(open('$REG')):
    if r['id'].lower()=='$pack'.lower(): print(r['repo']); break
")
  [ -n "$url" ] || { echo "  no repo in registry, skipping"; continue; }

  # one dir per snapshot, named x<content-hash> of the pack's JS
  snap=$(ls "db/$pack" 2>/dev/null | head -1)
  v2root="db/$pack/$snap/v2"
  [ -d "$v2root" ] || { echo "  no converted tree at $v2root, skipping"; continue; }

  dest="$COMFY/custom_nodes/$(basename "$url" .git)"
  if [ -d "$dest" ]; then
    echo "  already cloned: $dest"
  else
    echo "  cloning $url"
    git clone --depth 1 --quiet "$url" "$dest" || { echo "  CLONE FAILED"; continue; }
  fi

  # Verify every converted file parses as ESM before it goes anywhere near the app.
  bad=0
  for f in $(find "$v2root" -name '*.js' | grep -v '\.min\.js$'); do
    cp "$f" /tmp/_inst_chk.mjs
    node --check /tmp/_inst_chk.mjs >/dev/null 2>&1 || { echo "  SYNTAX FAIL: $f"; bad=1; }
  done
  [ "$bad" -eq 0 ] || { echo "  refusing to install $pack"; continue; }

  # Overlay: for each converted file, find the matching path under the clone.
  copied=0
  for f in $(find "$v2root" -name '*.js'); do
    rel=${f#"$v2root"/}                 # e.g. ComfyUI-Custom-Scripts-HEAD/web/js/x.js
    sub=${rel#*/}                        # strip the pack-root dir -> web/js/x.js
    target="$dest/$sub"
    [ -f "$target" ] || continue         # only overwrite files the pack actually ships
    cp "$f" "$target"
    copied=$((copied + 1))
  done
  echo "  overlaid $copied converted file(s) onto $dest"
done

echo
echo "Restart ComfyUI to pick up newly cloned packs (JS-only changes need just a browser reload)."
