#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

pnpm typegen:docframe
git diff --exit-code -- src/schemas/docframe/generated/
