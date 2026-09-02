#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
seed="$repo_root/packages/account/import-guard-seed.ts"
trap 'rm -f "$seed"' EXIT

for forbidden in "@/stores/authStore" "../../src/stores/authStore"; do
  printf "import '%s'\n" "$forbidden" > "$seed"
  if "$repo_root/node_modules/.bin/eslint" "$seed" >/dev/null 2>&1; then
    echo "guard accepted forbidden import: $forbidden" >&2
    exit 1
  fi
done

if rg -n "from ['\"](pinia|nuxt|astro|firebase)|\b(window|document|localStorage|sessionStorage)\b" "$repo_root/packages/account/src/core" --glob '*.ts'; then
  echo 'core contains a forbidden framework, SDK, or browser-global dependency' >&2
  exit 1
fi

echo 'guard rejected alias and relative src imports'
