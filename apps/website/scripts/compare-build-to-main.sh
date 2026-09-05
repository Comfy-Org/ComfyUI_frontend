#!/bin/bash
# compare-build-to-main.sh -- prove a change leaves existing pages untouched.
# Usage: scripts/compare-build-to-main.sh <baseline-dist> <candidate-dist> [label]
#   baseline = a build of main at `git merge-base origin/main HEAD`
#   candidate = a build of your branch (release shape: WORKSHOP_IN_BUILD=0)
#
# Compare every rendered page between a baseline build and a candidate build,
# after stripping build noise that differs run-to-run without meaning anything:
#   - hashed asset filenames   /_astro/name.Bx7f3kQ.css  ->  /_astro/name.HASH.css
#   - astro-island uids        uid="Z1abc23"             ->  uid="UID"
#   - island render timings
# Everything else must be byte-identical or it is reported.
set -euo pipefail
export LC_ALL=C
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo 'Usage: compare-build-to-main.sh <baseline-dist> <candidate-dist> [label]' >&2
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
changed=0; changed_list=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  norm "$BASE/$f" > "$compare_tmp/base-page"
  norm "$CAND/$f" > "$compare_tmp/candidate-page"
  if ! cmp -s "$compare_tmp/base-page" "$compare_tmp/candidate-page"; then
    changed=$((changed+1)); changed_list="$changed_list$f"$'\n'
  fi
done <<< "$common"
n_base=$(wc -l < "$compare_tmp/base" | tr -d ' ')
n_cand=$(wc -l < "$compare_tmp/candidate" | tr -d ' ')
n_removed=$(printf '%s' "$removed" | grep -c . || true)
n_added=$(printf '%s' "$added" | grep -c . || true)
n_added_ws=$(printf '%s' "$added" | grep -c '^\./workshop/' || true)
echo "=== $LABEL vs main ==="
printf '  pages on main        %s\n  pages on %-12s %s\n' "$n_base" "$LABEL" "$n_cand"
printf '  existing changed     %s\n  removed              %s\n  added                %s  (under /workshop: %s)\n' "$changed" "$n_removed" "$n_added" "$n_added_ws"
[ "$changed" -gt 0 ] && { echo "  --- changed ---"; printf '%s' "$changed_list" | head -20; }
[ "$n_removed" -gt 0 ] && { echo "  --- removed ---"; printf '%s\n' "$removed" | head -20; }
[ "$n_added" -gt 0 ] && [ "$n_added" != "$n_added_ws" ] && { echo "  --- added OUTSIDE /workshop ---"; printf '%s\n' "$added" | grep -v '^\./workshop/' | head -20; }
# shared CSS: token-level comparison (split on { } ;). Splitting on } alone
# mis-reports a minified Tailwind v4 file as one giant rule.
tok() { find "$1" -type f -name '*.css' \( -path '*/_website/*' -o -path '*/_astro/*' \) -exec cat {} + | tr '{};' '\n' | sed '/^[[:space:]]*$/d' | sort -u; }
printf '  css tokens removed   %s\n  css tokens added     %s\n' "$(comm -23 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)" "$(comm -13 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)"
b=$(find "$BASE" -type f -path '*/_website/*.css' -print -quit); c=$(find "$CAND" -type f -path '*/_website/*.css' -print -quit)
[ -n "$b" ] && [ -n "$c" ] && printf '  css gzipped          %s -> %s bytes (%+d)\n' "$(gzip -c "$b" | wc -c | tr -d ' ')" "$(gzip -c "$c" | wc -c | tr -d ' ')" "$(( $(gzip -c "$c" | wc -c) - $(gzip -c "$b" | wc -c) ))"
test "$changed" -eq 0 && test "$n_removed" -eq 0
