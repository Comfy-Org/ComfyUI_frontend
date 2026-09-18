#!/usr/bin/env bash
# Shared workspace builder for the fix-it eval cases. Each case's fixture.sh
# calls this with its own state directory. It creates a small git repository
# whose main and pull request branches mirror a website change, copies the
# website skills into the place the skills expect to find each other, and
# installs the gh stand-in with the case's fixture state.
set -euo pipefail
case_state="$1"
shared="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills="$(cd "$shared/../../.." && pwd)"

git init -q -b main .
git config user.email eval@example.com
git config user.name "Eval Fixture"

mkdir -p apps/website/.claude/skills apps/website/src/pages apps/website/src/config
cp -R "$skills/task" apps/website/.claude/skills/task
cp -R "$skills/fix-it" apps/website/.claude/skills/fix-it
rm -rf apps/website/.claude/skills/*/evals
cp "$skills/../../AGENTS.md" apps/website/AGENTS.md
printf '# Repository Guidelines\n\nThis is the eval copy of the repository.\n' > AGENTS.md
printf 'export const routes = ["/", "/pricing"]\n' > apps/website/src/config/routes.ts
printf -- '---\n---\n<h1>Pricing</h1>\n' > apps/website/src/pages/pricing.astro
git add -A && git commit -q -m "chore: seed the eval repository"

branch="$(cat "$case_state/branch")"
git checkout -q -b "$branch"
printf -- '---\n---\n<h1>Pricing</h1>\n<p>Start free, upgrade when you need more.</p>\n' > apps/website/src/pages/pricing.astro
git add -A && git commit -q -m "feat(website): add the pricing subheading"
git checkout -q main
git update-ref refs/remotes/origin/main main
git update-ref "refs/remotes/origin/$branch" "$branch"

mkdir -p bin
cp "$shared/gh" bin/gh
chmod +x bin/gh
cp -R "$case_state" bin/state
head="$(git rev-parse "$branch")"
printf "%s" "$head" > bin/state/head_sha
for f in bin/state/*.json; do sed -i.bak "s/__HEAD__/$head/g" "$f" && rm -f "$f.bak"; done
: > bin/calls.log
