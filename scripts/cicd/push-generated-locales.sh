#!/bin/bash
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <target-branch>" >&2
  exit 2
fi

target_branch="$1"
starting_head="$(git rev-parse HEAD)"

git fetch origin "$target_branch"
remote_head="$(git rev-parse FETCH_HEAD)"

if [ "$remote_head" != "$starting_head" ]; then
  echo "::error::Locale branch moved from $starting_head to $remote_head; rerun against the new head" >&2
  exit 1
fi

if git ls-files --unmerged -- src/locales | grep -q .; then
  echo '::error::Locale files have unresolved merge conflicts' >&2
  exit 1
fi

git add src/locales/

if git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- src/locales; then
  echo '::error::Locale files contain merge-conflict markers' >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo '::error::jq is required to validate locale JSON' >&2
  exit 127
fi

invalid_json=0
while IFS= read -r -d '' locale_file; do
  case "$locale_file" in
    *.json)
      if ! jq -e . "$locale_file" >/dev/null; then
        echo "::error::Invalid JSON syntax: $locale_file" >&2
        invalid_json=1
      fi
      ;;
  esac
done < <(git ls-files -z -- src/locales)

if [ "$invalid_json" -ne 0 ]; then
  exit 1
fi

git diff --cached --check -- src/locales/

if git diff --cached --quiet -- src/locales/; then
  exit 0
fi

git config user.name 'github-actions'
git config user.email 'github-actions@github.com'
git commit -m 'Update locales'
git push origin "HEAD:refs/heads/$target_branch"
