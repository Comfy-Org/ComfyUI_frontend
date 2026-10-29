#!/usr/bin/env bash
set -euo pipefail
node scripts/cicd/check-design-system-sources.ts
FIXTURE=$(mktemp -d)
trap 'rm -rf "$FIXTURE"' EXIT
CONSUMER="$FIXTURE/components"
CSS_CONSUMER="$FIXTURE/css"
mkdir "$CONSUMER" "$CSS_CONSUMER"
cp packages/design-system/tests/consumer/* "$CONSUMER/"
mv "$CONSUMER/package.json.template" "$CONSUMER/package.json"
mv "$CONSUMER/tsconfig.json.template" "$CONSUMER/tsconfig.json"
printf 'hoist=false\n' > "$CONSUMER/.npmrc"
cp packages/design-system/tests/consumer/{index.html,vite.config.ts} "$CSS_CONSUMER/"
cp packages/design-system/tests/css-consumer/* "$CSS_CONSUMER/"
mv "$CSS_CONSUMER/package.json.template" "$CSS_CONSUMER/package.json"
printf 'hoist=false\n' > "$CSS_CONSUMER/.npmrc"
pnpm --config.ignore-scripts=true -C packages/design-system pack --pack-destination "$FIXTURE"
pnpm --dir "$CSS_CONSUMER" add --ignore-scripts "$FIXTURE"/*.tgz
pnpm --dir "$CSS_CONSUMER" run check
pnpm --dir "$CONSUMER" add --ignore-scripts "$FIXTURE"/*.tgz
pnpm --dir "$CONSUMER" run check
pnpm --dir "$CONSUMER" add --ignore-scripts reka-ui@2.10.5
pnpm --dir "$CONSUMER" run check
