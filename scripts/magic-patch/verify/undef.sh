#!/bin/sh
# Finds converted files that reference identifiers which no longer exist.
#
# This is the class of failure no syntax check can see: a conversion that drops
# `import { app } from ".../scripts/app.js"` but leaves `app.graph` in the body
# is perfectly valid JavaScript and throws ReferenceError at load. It is also
# invisible to the conformance checker, which looks for `app.registerExtension`
# rather than bare `app.` — and a bare `app.`/`api.` regex false-positives on
# packs that legitimately declare their own local of that name. Scope analysis
# is the precise tool, so ESLint's no-undef does the work here.
#
# Every pack has pre-existing undefined names (script-tag globals such as
# `marked`, `Sortable`, `ace`), so the same check runs against the ORIGINAL and
# only the difference is reported. Otherwise the noise buries the signal.
set -e
cd "$(dirname "$0")/../../.."

# Always clear the scratch, including on failure: it holds unconverted sources
# whose old-API imports trip other repo-wide checks if they outlive the run.
trap 'rm -rf scripts/magic-patch/verify/.undef*' EXIT

rm -rf scripts/magic-patch/verify/.undefchk scripts/magic-patch/verify/.undeforig
mkdir -p scripts/magic-patch/verify/.undefchk scripts/magic-patch/verify/.undeforig
: > scripts/magic-patch/verify/.undefmap.txt

i=0
for d in $(find db/*/xHEAD/v2 -name '*.js' 2>/dev/null); do
  s=$(echo "$d" | sed 's|/xHEAD/v2/|/xHEAD/|')
  [ -f "$s" ] || continue
  cmp -s "$s" "$d" && continue
  i=$((i + 1))
  cp "$d" "scripts/magic-patch/verify/.undefchk/f$i.mjs"
  cp "$s" "scripts/magic-patch/verify/.undeforig/f$i.mjs"
  echo "f$i.mjs|$d" >> scripts/magic-patch/verify/.undefmap.txt
done
echo "checking $i converted files"

node_modules/.bin/eslint --no-config-lookup -c scripts/magic-patch/verify/undef.config.mjs \
  "scripts/magic-patch/verify/.undefchk/**/*.mjs" --format json 2>/dev/null > scripts/magic-patch/verify/.undef_conv.json || true
node_modules/.bin/eslint --no-config-lookup -c scripts/magic-patch/verify/undef.config.mjs \
  "scripts/magic-patch/verify/.undeforig/**/*.mjs" --format json 2>/dev/null > scripts/magic-patch/verify/.undef_orig.json || true

python3 - <<'PY'
import json

def undefined(path):
    out = {}
    for r in json.load(open(path)):
        fn = r['filePath'].split('/')[-1]
        out[fn] = {m['message'].split("'")[1]
                   for m in r['messages'] if m.get('ruleId') == 'no-undef'}
    return out

conv = undefined('scripts/magic-patch/verify/.undef_conv.json')
orig = undefined('scripts/magic-patch/verify/.undef_orig.json')
paths = dict(l.split('|', 1) for l in open('scripts/magic-patch/verify/.undefmap.txt').read().splitlines())

broken = []
for fn, names in conv.items():
    introduced = names - orig.get(fn, set())
    if introduced:
        broken.append((paths.get(fn, fn), sorted(introduced)))

if not broken:
    print('\nno undefined references introduced by any conversion')
else:
    print(f'\nBROKEN — {len(broken)} conversion(s) reference names that no longer exist:')
    for path, names in broken:
        print(f"  {path.replace('db/', '')}\n      {', '.join(names)}")
    raise SystemExit(1)
PY
