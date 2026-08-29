#!/usr/bin/env bash
set -euo pipefail

output=scripts/primevue-import-allowlist.ts

{
  echo 'export const primeVueImportAllowlist = ['
  rg -l "from '(primevue|@primevue)" src/ | sort | sed "s|^|  '|; s|$|',|"
  echo '] as const'
} > "$output"

pnpm exec oxfmt --write "$output"
