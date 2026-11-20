#!/usr/bin/env bash
set -euo pipefail

readonly VERSION_RE='^([0-9]+\.[0-9]+\.[0-9]+)(\.dev([0-9]+))?$'

die() {
  echo "comfyui-bump-guard: $*" >&2
  echo "usage: $0 <target-version> [<requirements.txt>...]" >&2
  exit 2
}

sort_key() {
  [[ "$1" =~ $VERSION_RE ]] || die "unsupported version '$1' (want X.Y.Z or X.Y.Z.devN)"
  local release="${BASH_REMATCH[1]}" dev="${BASH_REMATCH[3]}"
  if [[ -n "$dev" ]]; then
    printf '%s.0.%s\n' "$release" "$dev"
  else
    printf '%s.1.0\n' "$release"
  fi
}

pinned_version() {
  local pin
  pin=$(sed -n 's/^comfyui-frontend-package==\([^[:space:];#]*\).*/\1/p' "$1" | head -n1)
  [[ -n "$pin" ]] || die "no exact comfyui-frontend-package== pin in $1"
  printf '%s\n' "$pin"
}

newer_than() {
  local candidate target
  candidate=$(sort_key "$1") || exit 2
  target=$(sort_key "$2") || exit 2
  [[ "$candidate" != "$target" ]] &&
    [[ "$(printf '%s\n%s\n' "$candidate" "$target" | sort -V | tail -n1)" == "$candidate" ]]
}

target="${1:-}"
[[ -n "$target" ]] || die "missing target version"
sort_key "$target" >/dev/null
shift

for requirements in "$@"; do
  pin=$(pinned_version "$requirements")
  if newer_than "$pin" "$target"; then
    echo skip
    exit 0
  fi
done
echo proceed
