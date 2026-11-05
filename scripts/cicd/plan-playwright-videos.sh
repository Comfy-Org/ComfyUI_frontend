#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo '{"matrix":{"include":[]},"hits":[]}'
  exit 0
fi

salt=${VIDEO_CACHE_SALT:-}
cache_index=${VIDEO_CACHE_INDEX:-/dev/null}

report=$(mktemp)
trap 'rm -f "$report"' EXIT
PLAYWRIGHT_JSON_OUTPUT_NAME="$report" pnpm exec playwright test \
  --project=chromium --project=cloud --list --reporter=json \
  --pass-with-no-tests "$@" >&2

specs=$(jq -r '
  .config.rootDir as $root
  | .suites[]
  | ($root + "/" + .file) as $file
  | [.. | objects | .tests? // empty | .[] | .projectName]
  | group_by(.)[]
  | [.[0], $file, length]
  | @tsv
' "$report")

hits=()
misses=()
while IFS=$'\t' read -r project absolute tests; do
  [ -n "$project" ] || continue
  file=${absolute#"$PWD"/}
  key=$(printf '%s\n' "$salt" "$project" "$file" "$(sha256sum < "$file")" |
    sha256sum | cut -c1-32)
  sha=$(awk -F'\t' -v key="$key" '$1 == key { print $2; exit }' "$cache_index")
  if [ -n "$sha" ]; then
    hits+=("$key"$'\t'"$project"$'\t'"$file"$'\t'"$sha")
  else
    misses+=("$project"$'\t'"$file"$'\t'"$key"$'\t'"$tests")
  fi
done <<< "$specs"

printf '%s\n' ${misses[@]+"${misses[@]}"} | jq -Rsc --args '
  def pack($total):
    reduce sort_by(-.tests, .file)[] as $spec (
      [range($total) | {tests: 0, specs: []}];
      (to_entries | min_by(.value.tests) | .key) as $i
      | .[$i].tests += $spec.tests
      | .[$i].specs += [{file: $spec.file, key: $spec.key}]
    );
  split("\n")
  | map(select(length > 0) | split("\t")
      | {project: .[0], file: .[1], key: .[2], tests: (.[3] | tonumber)})
  | group_by(.project)
  | {
      matrix: {include: [
        .[] | .[0].project as $project
        | ([((map(.tests) | add) / 50 | ceil), 16, length] | min) as $total
        | pack($total) | to_entries[]
        | {project: $project, shardIndex: (.key + 1), shardTotal: $total,
           specs: .value.specs}
      ]},
      hits: ($ARGS.positional | map(split("\t")
        | {key: .[0], project: .[1], file: .[2], sha: .[3]}))
    }
' ${hits[@]+"${hits[@]}"}
