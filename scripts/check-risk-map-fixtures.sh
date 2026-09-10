#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
map="$repo_root/.github/risk.json"
fixtures="$repo_root/.github/risk-fixtures.json"

# Mirrors read_map() in Comfy-Org/github-workflows scripts/pr-risk/grade-pr-risk.sh
# at the workflows_ref pinned in .github/workflows/ci-pr-risk.yml (df10491).
# Upstream exits 2 and labels every PR risk:ungraded when this trips, so a map
# that fails here is not partially graded, it is not graded at all.
shape="$(jq -r '
  def known: ["R0", "R1", "R2", "R3"];
  if type != "object" then "not a JSON object"
  elif (.path_rules | type) != "array" then "path_rules is missing or not an array"
  elif (.path_rules | length) == 0 then "path_rules is EMPTY"
  elif ([.path_rules[] | select((.class | type) != "string" or (.paths | type) != "array" or (.paths | length) == 0)] | length) > 0
    then "a path rule is missing a class or a non-empty paths list"
  elif ([.path_rules[] | .tier | select(IN(known[]) | not)] | length) > 0
    then "a path rule carries a tier outside \(known)"
  elif (.provenance_tiers | type) != "object" then "provenance_tiers is missing or not an object"
  elif ([.provenance_tiers | to_entries[] | select(.key | startswith("_") | not) | .value | select(IN(known[]) | not)] | length) > 0
    then "provenance_tiers carries a tier outside \(known)"
  elif ((["runbook", "agent-supervised", "human", "external"] - [.provenance_tiers | keys[]]) | length) > 0
    then "provenance_tiers is missing a class: \(["runbook", "agent-supervised", "human", "external"] - [.provenance_tiers | keys[]])"
  elif ((.reversibility // {}) | has("test_path_patterns")) and (((.reversibility // {}).test_path_patterns | type) != "array")
    then "reversibility.test_path_patterns is present but not an array"
  elif (.default_tier // "R0") as $d | ($d | IN(known[])) | not then "default_tier is outside \(known)"
  elif [(.reversibility // {}) | .no_green_checks_tier, .no_test_touched_tier, .clean_tier | select(. != null and (IN(known[]) | not))] | length > 0
    then "a reversibility tier is outside \(known)"
  else empty end' "$map")"

if [ -n "$shape" ]; then
  echo "risk map unusable: $shape" >&2
  exit 1
fi

# glob2re, matches and rank are copied verbatim from the same upstream pin. An
# unrecognised tier ranks as the RISKIEST (3), never the safest: defaulting it
# low would let a typo silently downgrade a grade.
jq -e --slurpfile map "$map" '
  def glob2re:
    gsub("(?<c>[.+?^$(){}|\\[\\]\\\\])"; "\\\(.c)")
    | gsub("\\*\\*/"; "\u0002")
    | gsub("\\*\\*"; "\u0001")
    | gsub("\\*"; "[^/]*")
    | gsub("\u0002"; "(?:.*/)?")
    | gsub("\u0001"; ".*")
    | "^" + . + "$";
  def matches($path; $globs):
    any($globs[]?; . as $glob | $path | test($glob | glob2re));
  def rank: {R0: 0, R1: 1, R2: 2, R3: 3}[.] // 3;

  $map[0] as $risk_map
  | if .map_version != $risk_map.map_version then
      error("fixture map_version \(.map_version) does not match risk map \($risk_map.map_version)")
    else . end
  | [.cases[]
      | . as $case
      | [$risk_map.path_rules[] | select(matches($case.path; .paths))] as $hits
      | ($hits | map(.tier) | max_by(rank) // $risk_map.default_tier) as $actual_tier
      | ($hits | map(.class) | unique) as $actual_classes
      | select(
          $actual_tier != $case.tier
          or ($actual_classes | sort) != ($case.classes | sort)
        )
      | {
          path: $case.path,
          expected_tier: $case.tier,
          actual_tier: $actual_tier,
          missing_classes: ($case.classes - $actual_classes),
          unexpected_classes: ($actual_classes - $case.classes),
          actual_classes: $actual_classes
        }
    ] as $failures
  | if ($failures | length) == 0 then
      "risk-map fixtures passed: \(.cases | length)"
    else
      error("risk-map fixture failures: \($failures | tojson)")
    end
' "$fixtures" >/dev/null

echo "risk-map fixtures passed"
