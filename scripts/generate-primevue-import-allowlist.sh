#!/usr/bin/env bash
set -euo pipefail

output=scripts/primevue-import-allowlist.json
temp=$(mktemp scripts/primevue-import-allowlist.XXXXXX.json)
primevue_import_pattern="(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?)[\"'](?:primevue|@primevue)(?:/[^\"']*)?[\"']"
trap 'rm -f "$temp"' EXIT

{
  cat <<'HEADER'
{
  "$schema": "../node_modules/oxlint/configuration_schema.json",
  "overrides": [
    {
      "files": ["src/**/*.{ts,tsx,vue}"],
      "excludeFiles": [
HEADER
  { rg -l -U --pcre2 \
    -g '*.{ts,tsx,vue}' \
    -g '!src/scripts/*' \
    -g '!src/extensions/core/*' \
    "$primevue_import_pattern" src/ || [[ $? == 1 ]]; } |
    LC_ALL=C sort |
    sed 's|^|        "|; s|$|",|; $ s|,$||'
  cat <<'FOOTER'
      ],
      "rules": { "comfy/no-primevue-imports": "error" }
    }
  ]
}
FOOTER
} > "$temp"

pnpm exec oxfmt --write "$temp"
mv "$temp" "$output"
trap - EXIT
