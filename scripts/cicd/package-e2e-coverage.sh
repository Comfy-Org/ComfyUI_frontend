#!/usr/bin/env bash
set -euo pipefail

SHARDS_DIR="${1:?Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir>}"
COVERAGE_DIR="${2:?Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir>}"
HTML_DIR="${3:?Usage: package-e2e-coverage.sh <shards-dir> <coverage-dir> <html-dir>}"

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

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo 'has-coverage=true' >> "$GITHUB_OUTPUT"
fi

mkdir -p "$COVERAGE_DIR"
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
