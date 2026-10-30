#!/usr/bin/env bash
# Decide whether the weekly ComfyUI release may overwrite the shared bump PR.
#
# Usage: comfyui-bump-guard.sh <target-version> [<pending-version>]
#
# Prints "skip" when the open bump PR already pins a newer frontend than
# <target-version> (a patch on an older line must not downgrade it), and
# "proceed" otherwise, including when no PR is pending.
set -euo pipefail

target="${1:-}"
pending="${2:-}"
version_re='^[0-9]+\.[0-9]+\.[0-9]+([.-]?[0-9A-Za-z.]+)?$'

if [[ ! "$target" =~ $version_re ]]; then
  echo "invalid target version: '${target}'" >&2
  exit 2
fi

if [[ -z "$pending" || "$pending" == "$target" ]]; then
  echo proceed
  exit 0
fi

# Compare X.Y.Z first; on a tie, a pre-release (1.59.0.dev2) is older than
# the release (1.59.0). sort -V alone orders those the other way round.
base() { [[ "$1" =~ ^([0-9]+\.[0-9]+\.[0-9]+) ]] && echo "${BASH_REMATCH[1]}"; }
target_base=$(base "$target")
pending_base=$(base "$pending" || true)

if [[ -z "$pending_base" ]]; then
  echo proceed
elif [[ "$target_base" != "$pending_base" ]]; then
  newest=$(printf '%s\n%s\n' "$target_base" "$pending_base" | sort -V | tail -n1)
  [[ "$newest" == "$pending_base" ]] && echo skip || echo proceed
elif [[ "$pending" == "$pending_base" ]]; then
  # Same base: pending is the release, target a pre-release of it.
  echo skip
elif [[ "$target" == "$target_base" ]]; then
  echo proceed
else
  newest=$(printf '%s\n%s\n' "$target" "$pending" | sort -V | tail -n1)
  [[ "$newest" == "$pending" ]] && echo skip || echo proceed
fi
