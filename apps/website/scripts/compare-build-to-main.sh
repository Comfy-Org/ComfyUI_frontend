#!/bin/bash
#/ Usage: compare-build-to-main.sh <baseline-dist> <candidate-dist> [label]
#/
#/ Prove a change leaves existing pages untouched. Compares every rendered page
#/ between a baseline build and a candidate build, after stripping build noise
#/ that differs run-to-run without meaning anything:
#/
#/   - hashed asset filenames   /_astro/name.Bx7f3kQ.css  ->  /_astro/name.HASH.css
#/   - astro-island uids        uid="Z1abc23"             ->  uid="UID"
#/   - island render timings
#/
#/ Everything else must be byte-identical or it is reported.
#/
#/ Arguments:
#/   baseline-dist   build of main at `git merge-base origin/main HEAD`
#/   candidate-dist  build of your branch (release shape: WORKSHOP_IN_BUILD=0)
#/   label           name for the candidate in the report (default: candidate)
#/
#/ Options:
#/   -h, --help      show this help and exit
#/
#/ Exit status:
#/   0  no existing page changed and none were removed
#/   1  differences found, see the report
#/   2  usage error
#/
#/ Example:
#/   scripts/compare-build-to-main.sh /tmp/main-dist apps/website/dist workshop
#
set -euo pipefail
export LC_ALL=C

usage() { grep '^#/' "$0" | cut -c4-; }

case "${1:-}" in
  -h|--help|help) usage; exit 0 ;;
esac

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  usage | sed -n '1p' >&2
  echo "Run 'scripts/compare-build-to-main.sh --help' for details." >&2
  exit 2
fi
BASE=$(cd "$1" && pwd)
CAND=$(cd "$2" && pwd)
LABEL="${3:-candidate}"
compare_tmp=$(mktemp -d)
trap 'rm -rf "$compare_tmp"' EXIT
norm() {
  sed -E \
    -e 's#(/_(astro|website)/[A-Za-z0-9_.-]+)\.[A-Za-z0-9_-]{6,}\.(css|js|mjs|woff2?|png|jpe?g|webp|avif|svg)#\1.HASH.\3#g' \
    -e 's#(<astro-island[^>]* )uid="[A-Za-z0-9_-]+"#\1uid="UID"#g' \
    -e 's#(<astro-island[^>]* )server-render-time="[0-9.]+"#\1server-render-time="T"#g' \
    "$1"
}
(cd "$BASE" && find . -type f -name '*.html' | sort) > "$compare_tmp/base"
(cd "$CAND" && find . -type f -name '*.html' | sort) > "$compare_tmp/candidate"
if [ ! -s "$compare_tmp/base" ] || [ ! -s "$compare_tmp/candidate" ]; then
  echo 'Both inputs must contain built HTML pages.' >&2
  exit 2
fi
removed=$(comm -23 "$compare_tmp/base" "$compare_tmp/candidate")
added=$(comm -13 "$compare_tmp/base" "$compare_tmp/candidate")
common=$(comm -12 "$compare_tmp/base" "$compare_tmp/candidate")
changed_files=()
while IFS= read -r f; do
  if [ -z "$f" ]; then
    continue
  fi
  norm "$BASE/$f" > "$compare_tmp/base-page"
  norm "$CAND/$f" > "$compare_tmp/candidate-page"
  if ! cmp -s "$compare_tmp/base-page" "$compare_tmp/candidate-page"; then
    changed_files+=("$f")
  fi
done <<< "$common"
changed=${#changed_files[@]}

n_base=$(wc -l < "$compare_tmp/base" | tr -d ' ')
n_cand=$(wc -l < "$compare_tmp/candidate" | tr -d ' ')
n_removed=$(printf '%s' "$removed" | grep -c . || true)
n_added=$(printf '%s' "$added" | grep -c . || true)
n_added_ws=$(printf '%s' "$added" | grep -c '^\./workshop/' || true)

echo "=== $LABEL vs main ==="
printf '  pages on main        %s\n  pages on %-12s %s\n' "$n_base" "$LABEL" "$n_cand"
printf '  existing changed     %s\n  removed              %s\n  added                %s  (under /workshop: %s)\n' "$changed" "$n_removed" "$n_added" "$n_added_ws"

if [ "$changed" -gt 0 ]; then
  echo "  --- changed ---"
  printf '%s\n' "${changed_files[@]}" | sed -n '1,20p'
fi

if [ "$n_removed" -gt 0 ]; then
  echo "  --- removed ---"
  printf '%s\n' "$removed" | sed -n '1,20p'
fi

if [ "$n_added" -gt 0 ] && [ "$n_added" != "$n_added_ws" ]; then
  echo "  --- added OUTSIDE /workshop ---"
  printf '%s\n' "$added" | grep -v '^\./workshop/' | sed -n '1,20p'
fi

# shared CSS: token-level comparison (split on { } ;). Splitting on } alone
# mis-reports a minified Tailwind v4 file as one giant rule.
tok() {
  find "$1" -type f -name '*.css' \
    \( -path '*/_website/*' -o -path '*/_astro/*' \) \
    -exec cat {} + |
    tr '{};' '\n' |
    sed '/^[[:space:]]*$/d' |
    sort -u
}

css_tokens_removed=$(comm -23 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)
css_tokens_added=$(comm -13 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)
printf '  css tokens removed   %s\n  css tokens added     %s\n' \
  "$css_tokens_removed" "$css_tokens_added"

baseline_css=$(find "$BASE" -type f -path '*/_website/*.css' -print -quit)
candidate_css=$(find "$CAND" -type f -path '*/_website/*.css' -print -quit)
if [ -n "$baseline_css" ] && [ -n "$candidate_css" ]; then
  baseline_gzip=$(gzip -c "$baseline_css" | wc -c | tr -d ' ')
  candidate_gzip=$(gzip -c "$candidate_css" | wc -c | tr -d ' ')
  printf '  css gzipped          %s -> %s bytes (%+d)\n' \
    "$baseline_gzip" "$candidate_gzip" \
    "$((candidate_gzip - baseline_gzip))"
fi

if [ "$changed" -gt 0 ] || [ "$n_removed" -gt 0 ]; then
  exit 1
fi
