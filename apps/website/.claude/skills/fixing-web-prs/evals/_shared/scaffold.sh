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
git config core.hooksPath .git/hooks

mkdir -p apps/website/.claude/skills apps/website/src/pages apps/website/src/config
cp -R "$skills/building-web-prs" apps/website/.claude/skills/building-web-prs
cp -R "$skills/fixing-web-prs" apps/website/.claude/skills/fixing-web-prs
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
cp "$shared/snapshot-pr.sh" bin/snapshot-pr.sh
chmod +x bin/snapshot-pr.sh
# macOS's /usr/bin/git is an xcrun shim that needs a writable cache the eval
# sandbox denies, so give the workspace a direct git binary resolved now.
real_git="$(xcrun -f git 2>/dev/null || command -v git)"
printf '#!/usr/bin/env bash\nexec "%s" "$@"\n' "$real_git" > bin/git
chmod +x bin/git
chmod +x bin/gh
mkdir -p bin/state
cp -R "$shared/base/." bin/state/
if [[ -d "$case_state" ]]; then cp -R "$case_state/." bin/state/; fi
: > bin/calls.log

branch="$(cat bin/state/branch)"
if [[ "$mode" == "with-branch" ]]; then
  git checkout -q -b "$branch"
  printf -- '---\n---\n<h1>Pricing</h1>\n<p>Start free, upgrade when you need more.</p>\n<p>No card needed to start.</p>\n' > apps/website/src/pages/pricing.astro
  if [[ -f bin/state/branch_files.txt ]]; then
    while IFS='|' read -r path content; do [[ -n "$path" ]] || continue; mkdir -p "$(dirname "$path")"; printf '%b' "$content" > "$path"; done < bin/state/branch_files.txt
  fi
  git add -A && git commit -q -m "feat(website): add the pricing subheading"
  git checkout -q main
  git update-ref "refs/remotes/origin/$branch" "$branch"
  git rev-parse "$branch" | tr -d '\n' > bin/state/head_sha
else
  git rev-parse main | tr -d '\n' > bin/state/head_sha
fi
