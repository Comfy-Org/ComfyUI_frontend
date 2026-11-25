#!/usr/bin/env bash
set -euo pipefail

: "${GH_REPO:?}" "${COMFYUI_PIN_SHA:?}"
: "${ACTIVE_CORE_TARGETS?}" "${RETIRED_CORE_TARGETS?}"

LATEST_PIN_SHA=$(git ls-remote https://github.com/Comfy-Org/ComfyUI.git refs/heads/master | cut -f1)
if [ "$LATEST_PIN_SHA" != "$COMFYUI_PIN_SHA" ]; then
  echo '::error::ComfyUI changed during reconciliation; retry with fresh history.'
  exit 1
fi

RULESET_NAME='Retired core release lines'
RULESETS=$(gh api "repos/$GH_REPO/rulesets" --paginate --slurp)
RULESET_ID=$(jq -er --arg name "$RULESET_NAME" \
  '[.[][] | select(.name == $name)] | if length <= 1 then (.[0].id // "") else error("Duplicate retirement rulesets") end' <<< "$RULESETS")
BODY=$(jq -n --arg name "$RULESET_NAME" --arg retired "$RETIRED_CORE_TARGETS" '{
  name: $name, target: "branch",
  enforcement: (if $retired == "" then "disabled" else "active" end),
  bypass_actors: [],
  conditions: {ref_name: {include: ($retired | split(" ") | map(select(. != "") | "refs/heads/" + .)), exclude: []}},
  rules: [{type: "update", parameters: {update_allows_fetch_and_merge: false}}, {type: "deletion"}, {type: "non_fast_forward"}]
}')

if [ "${APPLY:-false}" != 'true' ]; then
  echo "$BODY"
  echo "Viable targets: $ACTIVE_CORE_TARGETS"
  exit 0
fi

if [ -n "$RULESET_ID" ]; then
  gh api --method PUT "repos/$GH_REPO/rulesets/$RULESET_ID" --input - <<< "$BODY" >/dev/null
elif [ -n "$RETIRED_CORE_TARGETS" ]; then
  gh api --method POST "repos/$GH_REPO/rulesets" --input - <<< "$BODY" >/dev/null
fi
