#!/usr/bin/env bash
set -euo pipefail

USAGE='Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir> <expected-shards>'
SHARDS_DIR="${1:?$USAGE}"
COVERAGE_DIR="${2:?$USAGE}"
HTML_DIR="${3:?$USAGE}"
EXPECTED_SHARDS="${4:?$USAGE}"

# Bash resolves a non-numeric operand of -ge to 0, which would silently mark
# every partial merge complete.
if ! [[ "$EXPECTED_SHARDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::expected-shards must be a positive integer, got '$EXPECTED_SHARDS'."
  exit 1
fi

append_summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '%s\n' "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

COVERAGE_FILES=()
if [[ -d "$SHARDS_DIR" ]]; then
  while IFS= read -r -d '' file; do
    COVERAGE_FILES+=("$file")
  done < <(find "$SHARDS_DIR" -name 'coverage.lcov' -type f -print0 | sort -z)
fi

if [[ ${#COVERAGE_FILES[@]} -eq 0 ]]; then
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo 'has-coverage=false' >> "$GITHUB_OUTPUT"
  fi
  append_summary 'No E2E coverage shard artifacts found; treating this run as skipped.'
  exit 0
fi

FOUND_SHARDS=${#COVERAGE_FILES[@]}
if [[ "$FOUND_SHARDS" -ge "$EXPECTED_SHARDS" ]]; then
  COMPLETE=true
else
  COMPLETE=false
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo 'has-coverage=true'
    echo "shards-found=$FOUND_SHARDS"
    echo "shards-expected=$EXPECTED_SHARDS"
    echo "complete=$COMPLETE"
  } >> "$GITHUB_OUTPUT"
fi

mkdir -p "$COVERAGE_DIR"

# Every shard loads the whole bundle, so a lost shard drops its hits but keeps
# the lines they covered in the denominator: partial merges understate coverage.
printf '{"shardsFound":%d,"shardsExpected":%d,"complete":%s}\n' \
  "$FOUND_SHARDS" "$EXPECTED_SHARDS" "$COMPLETE" \
  > "$COVERAGE_DIR/coverage-metadata.json"

if [[ "$COMPLETE" != true ]]; then
  echo "::warning::Partial E2E coverage merge: $FOUND_SHARDS/$EXPECTED_SHARDS shards reported coverage. The merged total understates real coverage and is excluded from trend reporting."
fi

ADD_ARGS=()
for file in "${COVERAGE_FILES[@]}"; do
  ADD_ARGS+=(-a "$file")
done
lcov "${ADD_ARGS[@]}" -o "$COVERAGE_DIR/coverage.lcov"

MERGED_SF=$(grep -c '^SF:' "$COVERAGE_DIR/coverage.lcov" || true)
MERGED_LH=$(awk -F: '/^LH:/{s+=$2}END{print s+0}' "$COVERAGE_DIR/coverage.lcov")
MERGED_LF=$(awk -F: '/^LF:/{s+=$2}END{print s+0}' "$COVERAGE_DIR/coverage.lcov")
append_summary '### Merged coverage'
append_summary "- **$MERGED_SF** source files"
append_summary "- **$MERGED_LH / $MERGED_LF** lines hit"
append_summary "- **$FOUND_SHARDS / $EXPECTED_SHARDS** shards merged"
if [[ "$COMPLETE" != true ]]; then
  append_summary ''
  append_summary "> [!WARNING]"
  append_summary "> $((EXPECTED_SHARDS - FOUND_SHARDS)) shard(s) reported no coverage, so this total understates real coverage and is excluded from trend reporting."
fi
append_summary ''
append_summary '| Shard | Files | Lines Hit |'
append_summary '|-------|-------|-----------|'

for file in "${COVERAGE_FILES[@]}"; do
  SHARD=$(basename "$(dirname "$file")")
  SHARD_SF=$(grep -c '^SF:' "$file" || true)
  SHARD_LH=$(awk -F: '/^LH:/{s+=$2}END{print s+0}' "$file")
  append_summary "| $SHARD | $SHARD_SF | $SHARD_LH |"
done

MAPPED_SF=$(grep -cE '^SF:(src|packages)/' "$COVERAGE_DIR/coverage.lcov" || true)
append_summary "Source-mapped files: $MAPPED_SF"
if [[ "${MAPPED_SF:-0}" -lt 100 ]]; then
  OBSERVED_PATHS=$(grep -m 5 '^SF:' "$COVERAGE_DIR/coverage.lcov" | tr '\n' ' ' || true)
  echo "::error::Only $MAPPED_SF files under src/ or packages/ in the merged tracefile. Observed paths: $OBSERVED_PATHS. Served bundle paths mean the E2E build dropped its '//# sourceMappingURL=' comment — check it ran with COLLECT_COVERAGE=true (vite.config.mts build.sourcemap)."
  exit 1
fi

lcov --remove "$COVERAGE_DIR/coverage.lcov" \
  '*localhost-8188*' \
  'assets/images/*' \
  -o "$COVERAGE_DIR/coverage.lcov" \
  --ignore-errors unused

genhtml "$COVERAGE_DIR/coverage.lcov" \
  -o "$HTML_DIR" \
  --title 'ComfyUI E2E Coverage' \
  --no-function-coverage \
  --precision 1 \
  --ignore-errors source,unmapped \
  --synthesize-missing
