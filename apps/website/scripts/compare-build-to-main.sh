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
#   - ISO timestamps           2026-09-04T20:01:55.880Z  ->  TIMESTAMP
# Everything else must be byte-identical or it is reported.
set -uo pipefail
BASE="$1"; CAND="$2"; LABEL="${3:-candidate}"
norm() {
  sed -E \
    -e 's#(/_(astro|website)/[A-Za-z0-9_.-]+)\.[A-Za-z0-9_-]{6,}\.(css|js|mjs|woff2?|png|jpe?g|webp|avif|svg)#\1.HASH.\2#g' \
    -e 's#uid="[A-Za-z0-9_-]+"#uid="UID"#g' -e 's#server-render-time="[0-9.]+"#server-render-time="T"#g' \
    -e 's#[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})#TIMESTAMP#g' \
    "$1"
}
cd "$BASE" && find . -name '*.html' | sort > /tmp/cmp-base.list
cd "$CAND" && find . -name '*.html' | sort > /tmp/cmp-cand.list
removed=$(comm -23 /tmp/cmp-base.list /tmp/cmp-cand.list)
added=$(comm -13 /tmp/cmp-base.list /tmp/cmp-cand.list)
common=$(comm -12 /tmp/cmp-base.list /tmp/cmp-cand.list)
changed=0; changed_list=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! cmp -s <(norm "$BASE/$f") <(norm "$CAND/$f"); then
    changed=$((changed+1)); changed_list="$changed_list$f"$'\n'
  fi
done <<< "$common"
n_base=$(wc -l < /tmp/cmp-base.list | tr -d ' ')
n_cand=$(wc -l < /tmp/cmp-cand.list | tr -d ' ')
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
tok() { cat "$1"/_website/*.css "$1"/_astro/*.css 2>/dev/null | tr '{};' '\n\n\n' | sed '/^[[:space:]]*$/d' | sort -u; }
printf '  css tokens removed   %s\n  css tokens added     %s\n' "$(comm -23 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)" "$(comm -13 <(tok "$BASE") <(tok "$CAND") | grep -c . || true)"
b=$(ls "$BASE"/_website/*.css 2>/dev/null | head -1); c=$(ls "$CAND"/_website/*.css 2>/dev/null | head -1)
[ -n "$b" ] && [ -n "$c" ] && printf '  css gzipped          %s -> %s bytes (%+d)\n' "$(gzip -c "$b" | wc -c | tr -d ' ')" "$(gzip -c "$c" | wc -c | tr -d ' ')" "$(( $(gzip -c "$c" | wc -c) - $(gzip -c "$b" | wc -c) ))"
