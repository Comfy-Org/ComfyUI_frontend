#!/usr/bin/env bash
# Whatever release GitHub flags "latest" is what `--front-end-version latest` resolves to.
set -euo pipefail

: "${REPO:?REPO is required}"

summary() {
  [[ -n "${GITHUB_STEP_SUMMARY:-}" ]] && printf '%s\n' "$@" >>"$GITHUB_STEP_SUMMARY"
  return 0
}

releases_json=$(gh release list --repo "$REPO" --limit 1000 \
  --json tagName,isDraft,isPrerelease,isLatest)

if [[ "$(jq 'length' <<<"$releases_json")" -ge 1000 ]]; then
  echo "::warning::Release count hit the --limit 1000 cap; results may be truncated."
fi

# design-system, desktop-ui and npm-types cut their own tags in this repo.
readonly FRONTEND_TAG='^v[0-9]+\.[0-9]+\.[0-9]+$'

mapfile -t stable_tags < <(
  jq -r '.[] | select(.isDraft == false and .isPrerelease == false) | .tagName' \
    <<<"$releases_json" | grep -E "$FRONTEND_TAG" || true
)

if [[ ${#stable_tags[@]} -eq 0 ]]; then
  echo "::warning::No stable semver releases found; '--front-end-version latest' will 404 until one exists."
  exit 0
fi

highest_tag=$(printf '%s\n' "${stable_tags[@]}" | sort -V | tail -1)

current_tag=$(jq -r '[.[] | select(.isLatest)][0].tagName // empty' <<<"$releases_json")
echo "Highest stable semver: $highest_tag — GitHub's latest: ${current_tag:-<none>}"

if [[ "$current_tag" == "$highest_tag" ]]; then
  echo "OK: latest already matches the highest stable semver release."
  exit 0
fi

echo "::warning::latest is '${current_tag:-<none>}' but the highest stable release is '$highest_tag'; reassigning."
gh release edit "$highest_tag" --repo "$REPO" --latest

summary "## Latest-release auto-correction" "" \
  "- Previously flagged \`latest\`: \`${current_tag:-<none>}\`" \
  "- Reassigned \`latest\` to: \`$highest_tag\`"
