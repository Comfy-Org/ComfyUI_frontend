#!/usr/bin/env bash
set -euo pipefail
CONSUMER=$(mktemp -d)
trap 'rm -rf "$CONSUMER"' EXIT
cp packages/design-system/tests/consumer/* "$CONSUMER/"
mv "$CONSUMER/package.json.template" "$CONSUMER/package.json"
mv "$CONSUMER/tsconfig.json.template" "$CONSUMER/tsconfig.json"
printf 'hoist=false\n' > "$CONSUMER/.npmrc"
pnpm --config.ignore-scripts=true -C packages/design-system pack --pack-destination "$CONSUMER"
pnpm --dir "$CONSUMER" add --ignore-scripts "$CONSUMER"/*.tgz
pnpm --dir "$CONSUMER" run check
