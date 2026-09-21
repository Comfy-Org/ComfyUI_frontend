#!/usr/bin/env bash
set -euo pipefail

USAGE='Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir> <shards-succeeded> <source-sha>'
SHARDS_DIR="${1:?$USAGE}"
COVERAGE_DIR="${2:?$USAGE}"
HTML_DIR="${3:?$USAGE}"
SHARDS_SUCCEEDED="${4:?$USAGE}"
SOURCE_SHA="${5:?$USAGE}"

if [[ "$SHARDS_SUCCEEDED" != true && "$SHARDS_SUCCEEDED" != false ]]; then
  echo "::error::shards-succeeded must be 'true' or 'false', got '$SHARDS_SUCCEEDED'."
  exit 1
fi

UNVERIFIED_REASON='E2E coverage is not verified as a whole merge: the shard matrix did not pass, so a shard may have stopped early or produced nothing.'

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

# A shard that produced no coverage fails its own upload, and one that died
# partway still writes a tracefile, so neither absence nor thinness is visible
# here. Both turn the matrix red, which is the signal this reads.
COMPLETE="$SHARDS_SUCCEEDED"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo 'has-coverage=true'
    echo "complete=$COMPLETE"
  } >> "$GITHUB_OUTPUT"
fi

mkdir -p "$COVERAGE_DIR"

# A lost shard drops hits from commonly-loaded code and can remove files only
# it exercised, so an incomplete merge is not comparable with a whole one.
printf '{"complete":%s,"sourceSha":"%s"}\n' \
  "$COMPLETE" "$SOURCE_SHA" \
  > "$COVERAGE_DIR/coverage-metadata.json"

if [[ "$COMPLETE" != true ]]; then
  echo "::warning::$UNVERIFIED_REASON It is excluded from trend reporting."
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
if [[ "$COMPLETE" != true ]]; then
  append_summary ''
  append_summary "> [!WARNING]"
  append_summary "> $UNVERIFIED_REASON It is excluded from trend reporting."
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

HTML_TITLE='ComfyUI E2E Coverage'
if [[ "$COMPLETE" != true ]]; then
  HTML_TITLE="$HTML_TITLE — NOT VERIFIED AS A WHOLE MERGE"
fi

genhtml "$COVERAGE_DIR/coverage.lcov" \
  -o "$HTML_DIR" \
  --title "$HTML_TITLE" \
  --no-function-coverage \
  --precision 1 \
  --ignore-errors source,unmapped \
  --synthesize-missing
