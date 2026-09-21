#!/usr/bin/env bash
set -euo pipefail

USAGE='Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir> <expected-shards> <shards-succeeded>'
SHARDS_DIR="${1:?$USAGE}"
COVERAGE_DIR="${2:?$USAGE}"
HTML_DIR="${3:?$USAGE}"
EXPECTED_SHARDS="${4:?$USAGE}"
SHARDS_SUCCEEDED="${5:?$USAGE}"

# Bash resolves a non-numeric operand of -ge to 0, which would silently mark
# every partial merge complete.
if ! [[ "$EXPECTED_SHARDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::expected-shards must be a positive integer, got '$EXPECTED_SHARDS'."
  exit 1
fi

if [[ "$SHARDS_SUCCEEDED" != true && "$SHARDS_SUCCEEDED" != false ]]; then
  echo "::error::shards-succeeded must be 'true' or 'false', got '$SHARDS_SUCCEEDED'."
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

# A tracefile proves a shard uploaded, not that it finished: globalTeardown
# writes one even for a shard that died partway, and that shard's missing hits
# understate the merge exactly like an absent one. The matrix verdict is the
# only signal that separates the two.
REASON=''
if [[ "$FOUND_SHARDS" -lt "$EXPECTED_SHARDS" ]]; then
  REASON="only $FOUND_SHARDS of $EXPECTED_SHARDS shards reported coverage"
elif [[ "$SHARDS_SUCCEEDED" != true ]]; then
  REASON="all $EXPECTED_SHARDS shards reported coverage but the matrix did not pass, so a shard may have stopped early"
fi

if [[ -n "$REASON" ]]; then
  COMPLETE=false
else
  COMPLETE=true
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

# Every shard loads the whole bundle, so lost hits stay in the denominator:
# an incomplete merge understates coverage rather than omitting it.
printf '{"shardsFound":%d,"shardsExpected":%d,"complete":%s,"reason":"%s"}\n' \
  "$FOUND_SHARDS" "$EXPECTED_SHARDS" "$COMPLETE" "$REASON" \
  > "$COVERAGE_DIR/coverage-metadata.json"

if [[ "$COMPLETE" != true ]]; then
  echo "::warning::E2E coverage merge is not whole — $REASON. The merged total understates real coverage and is excluded from trend reporting."
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
  append_summary "> Not a whole merge — $REASON. This total understates real coverage and is excluded from trend reporting."
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
