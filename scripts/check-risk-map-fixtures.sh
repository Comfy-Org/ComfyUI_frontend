#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
map="$repo_root/.github/risk.json"
fixtures="$repo_root/.github/risk-fixtures.json"

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
  def rank: {R0: 0, R1: 1, R2: 2, R3: 3}[.] // -1;

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
          or (($case.classes - $actual_classes) | length) > 0
        )
      | {
          path: $case.path,
          expected_tier: $case.tier,
          actual_tier: $actual_tier,
          missing_classes: ($case.classes - $actual_classes),
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
