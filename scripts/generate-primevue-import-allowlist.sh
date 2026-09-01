#!/usr/bin/env bash
set -euo pipefail

output=scripts/primevue-import-allowlist.ts
primevue_import_pattern="(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?)[\"'](?:primevue|@primevue)(?:/[^\"']*)?[\"']"

{
  echo 'export const primeVueImportAllowlist = ['
  { rg -l -U --pcre2 "$primevue_import_pattern" src/ || [[ $? == 1 ]]; } |
    LC_ALL=C sort |
    sed "s|^|  '|; s|$|',|"
  echo '] as const'
} > "$output"

pnpm exec oxfmt --write "$output"
