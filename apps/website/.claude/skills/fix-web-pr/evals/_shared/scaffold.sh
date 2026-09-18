#!/usr/bin/env bash
# Shared workspace builder for the website skill evals. A case's fixture.sh
# calls this with the case's state directory (which may be empty) and,
# optionally, "no-branch" to leave the pull request branch uncreated for a
# case that must create its own.
#
# It builds a small git repository whose main branch mirrors a website
# checkout, copies the website skills into the place the skills expect to find
# each other, installs the gh stand-in with the shared base state overlaid by
# the case's overrides, and records the pull request branch head so the
# stand-in can insist on it.
set -euo pipefail
case_state="$1"
mode="${2:-with-branch}"
shared="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skills="$(cd "$shared/../../.." && pwd)"

git init -q -b main .
git config user.email eval@example.com
git config user.name "Eval Fixture"
git config commit.gpgsign false
git config tag.gpgsign false

mkdir -p apps/website/.claude/skills apps/website/src/pages apps/website/src/config
cp -R "$skills/build-web-pr" apps/website/.claude/skills/build-web-pr
cp -R "$skills/fix-web-pr" apps/website/.claude/skills/fix-web-pr
rm -rf apps/website/.claude/skills/*/evals
cp "$skills/../../AGENTS.md" apps/website/AGENTS.md
printf '# Repository Guidelines\n\nThis is the eval copy of the repository. Use pnpm, never npm.\n' > AGENTS.md
printf 'export const routes = ["/", "/pricing"]\n' > apps/website/src/config/routes.ts
printf -- '---\n---\n<h1>Pricing</h1>\n<p>Start free, upgrade when you need more.</p>\n' > apps/website/src/pages/pricing.astro
git add -A && git commit -q -m "chore: seed the eval repository"
git update-ref refs/remotes/origin/main main

printf "bin/\n" >> .git/info/exclude
mkdir -p bin
cp "$shared/gh" bin/gh
chmod +x bin/gh
mkdir -p bin/state
cp -R "$shared/base/." bin/state/
if [[ -d "$case_state" ]]; then cp -R "$case_state/." bin/state/; fi
: > bin/calls.log

branch="$(cat bin/state/branch)"
if [[ "$mode" == "with-branch" ]]; then
  git checkout -q -b "$branch"
  printf -- '---\n---\n<h1>Pricing</h1>\n<p>Start free, upgrade when you need more.</p>\n<p>No card needed to start.</p>\n' > apps/website/src/pages/pricing.astro
  git add -A && git commit -q -m "feat(website): add the pricing subheading"
  git checkout -q main
  git update-ref "refs/remotes/origin/$branch" "$branch"
  git rev-parse "$branch" | tr -d '\n' > bin/state/head_sha
else
  git rev-parse main | tr -d '\n' > bin/state/head_sha
fi
