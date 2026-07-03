#!/usr/bin/env bash
# shellcheck disable=SC2016  # backticks in block messages are literal markdown
# PreToolUse hook: redirect direct tool invocations to their pnpm scripts.
#
# Reads the Bash tool call as JSON on stdin and inspects the actual command
# string. This replaces the former per-hook `if: "Bash(npx tsc *)"` filters,
# whose static parser treated any command it could not fully resolve (loop
# variables, $(...), backticks, heredocs) as matching every pattern —
# blocking unrelated commands with misleading errors.

set -euo pipefail

cmd=$(jq -r '.tool_input.command // empty')

# Matches <tool> at a command position (start of line or after ; & | ( `),
# optionally prefixed by env assignments (CI=1) and/or a package runner, and
# followed by a non-word character or end of line. Word-anchored, so `vue-tsc`
# does not trip the `tsc` rule, `tsc=1` is an assignment not an invocation,
# and substrings inside quoted text at non-command positions are ignored.
runs_tool() {
  printf '%s' "$cmd" | grep -qE \
    "(^|[;&|(\`])[[:space:]]*([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)*((npx|pnpx|pnpm exec|pnpm dlx)[[:space:]]+)?$1([^A-Za-z0-9_.=/-]|\$)"
}

block() {
  echo "$1" >&2
  exit 2
}

runs_tool 'vue-tsc'   && block 'Use `pnpm typecheck` instead of running vue-tsc directly.'
runs_tool 'tsc'       && block 'Use `pnpm typecheck` instead of running tsc directly.'
runs_tool 'vitest'    && block 'Use `pnpm test:unit` (or `pnpm test:unit <path>`) instead of running vitest directly.'
runs_tool 'eslint'    && block 'Use `pnpm lint` or `pnpm lint:fix` instead of running eslint directly.'
runs_tool 'prettier'  && block 'This project uses oxfmt, not prettier. Use `pnpm format` or `pnpm format:check`.'
runs_tool 'oxlint'    && block 'Use `pnpm oxlint` instead of running oxlint directly.'
runs_tool 'stylelint' && block 'Use `pnpm stylelint` instead of running stylelint directly.'
runs_tool 'knip'      && block 'Use `pnpm knip` instead of running knip directly.'

exit 0
