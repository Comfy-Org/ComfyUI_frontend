"""Matrix harness builder.

For EVERY cloned API-using pack (corpus/repos/*), builds an isolated
per-pack vitest spec that: loads the pack's real JS, registers the standard
workflow's node defs through the real path (invoking the pack's
beforeRegisterNodeDef), invokes registerCustomNodes (registering the pack's
frontend-only node types), then runs the user-operation battery and drives the
pack's own registered node types.

Each spec writes one JSON row. Running the folder on the ECS branch and on the
pre-ECS merge-base and diffing the rows yields the pack x operation matrix.
"""
import argparse
import hashlib
import json, os, re, shutil, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from paths import CORPUS  # noqa: E402

DEST = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir, 'src', '__ecs_matrix__'))
REPOS = CORPUS
TEMPLATE = os.path.join(HERE, 'matrix_spec_template.ts')

PREFIX = r'(["\'])(?:/|(?:\./)?(?:\.\./)+)'
REWRITES = [
    (re.compile(PREFIX + r'scripts/app\.js\1'), '"@/scripts/app"'),
    (re.compile(PREFIX + r'scripts/api\.js\1'), '"@/scripts/api"'),
    (re.compile(PREFIX + r'scripts/ui\.js\1'), '"@/scripts/ui"'),
    (re.compile(PREFIX + r'scripts/widgets\.js\1'), '"@/scripts/widgets"'),
    (re.compile(PREFIX + r'scripts/utils\.js\1'), '"@/scripts/utils"'),
    (re.compile(PREFIX + r'scripts/domWidget\.js\1'), '"@/scripts/domWidget"'),
    (re.compile(PREFIX + r'scripts/ui/([\w/.-]+)\.js\1'), r'"@/scripts/ui/\2"'),
    (re.compile(PREFIX + r'extensions/core/([\w/.-]+)\.js\1'), r'"@/extensions/core/\2"'),
    # catch-all for any other real frontend scripts/* module the server serves
    (re.compile(PREFIX + r'scripts/([\w/.-]+)\.js\1'), r'"@/scripts/\2"'),
]
# Rules that name one pack. A per-pack correction inside a population
# measurement has to be visible in the output, so each rule carries the pack it
# assists and every pack it fires on is counted in the manifest and the summary.
PACK_REWRITES = [
    ('rgthree', re.compile(r'(["\'])(?:\.\./)+rgthree/config\.js\1'), r'"__PACKROOT__/web/comfyui/config.js"'),
    ('rgthree', re.compile(r'(["\'])(?:\.\./)+rgthree/'), r'"__PACKROOT__/web/'),
]
ENTRY_RX = re.compile(r'registerExtension|registerNodeType|beforeRegisterNodeDef')
ENTRY_CAP = 60
# The token scan cannot tell an extension entry from a test or an example that
# merely mentions the API. ComfyUI serves a pack's whole web directory but
# never boots these, so importing them manufactures both load failures and
# clean rows.
UNSERVED_DIRS = {'test', 'tests', '__tests__', 'spec', 'example', 'examples', 'docs'}
UNSERVED_FILE_RX = re.compile(r'\.(?:test|spec)\.m?js$')
JS = ('.js', '.mjs')
ASSETS = ('.css', '.json', '.svg', '.woff2', '.png')
SKIP = {'.git', 'node_modules', 'vendor', '__pycache__', 'dist', 'venv'}
# runtime fixture: copy what the pack ships; exclude only true vendored bundles
VEND = ('three.min', 'jquery', 'codemirror', 'chart.min', 'd3.min',
        'litegraph.core', '.min.js', 'fabric.min', 'protobuf')

TEMPLATE_RUNNER_IMPORT = "from './matrix_runner'"
SPEC_RUNNER_IMPORT = "from './runner'"
PLACEHOLDERS = (
    '__MATRIX_PACK__', '__MATRIX_SAFE__', '__MATRIX_ENTRIES__', '__MATRIX_PACK_DIR__'
)
RELATIVE_IMPORT_RX = re.compile(r"""(?:from|import)\s*\(?\s*['"](\.\.?/[^'"]+)['"]""")


def safe_name(pack: str) -> str:
    """Deterministic globally unique spec/row name for a pack id.

    Shards sanitise independently and their rows land in one merged directory,
    so uniqueness has to hold across shards and runs, not just within a build.
    A sanitisation that lost information carries a digest of what it lost.
    """
    safe = re.sub(r'[^A-Za-z0-9_]', '_', pack)
    if safe == pack:
        return safe
    return f'{safe}_{hashlib.sha1(pack.encode()).hexdigest()[:8]}'


def is_served(rel: str) -> bool:
    parts = rel.replace(os.sep, '/').lower().split('/')
    return not (
        any(p in UNSERVED_DIRS for p in parts[:-1])
        or UNSERVED_FILE_RX.search(parts[-1])
    )


def packroot_anchor(src: str, dst: str, fp: str) -> str:
    probe = os.path.dirname(fp)
    while probe == src or probe.startswith(src + os.sep):
        if os.path.isdir(os.path.join(probe, 'web')):
            return os.path.join(dst, os.path.relpath(probe, src))
        parent = os.path.dirname(probe)
        if parent == probe:
            break
        probe = parent
    return dst


def assert_runner_copy_depth(text: str) -> None:
    """The runner is copied out of HERE into DEST, so every relative import it
    carries has to name the same file from both directories."""
    for spec in sorted(set(RELATIVE_IMPORT_RX.findall(text))):
        here, there = (
            os.path.normpath(os.path.join(d, spec)) for d in (HERE, DEST)
        )
        if here != there:
            sys.exit(
                f"matrix_runner.ts imports '{spec}', which resolves to {here}"
                f' from {HERE} but to {there} from {DEST}. The runner is copied'
                ' between those directories; keep them at the same depth from'
                ' the repo root, or route the import through the @/ alias.'
            )
        if not any(os.path.exists(here + ext) for ext in ('', '.ts', '.js', '.json')):
            sys.exit(f"matrix_runner.ts imports '{spec}', which does not exist: {here}")


def load_spec_template() -> str:
    try:
        text = open(TEMPLATE, encoding='utf-8').read()
    except OSError as e:
        sys.exit(f'spec template unreadable: {TEMPLATE} ({e})')
    if text.count(TEMPLATE_RUNNER_IMPORT) != 1:
        sys.exit(f'{TEMPLATE} must contain {TEMPLATE_RUNNER_IMPORT} exactly once')
    for name in PLACEHOLDERS:
        if text.count(name) != 1:
            sys.exit(f'{TEMPLATE} must contain {name} exactly once')
    return text.replace(TEMPLATE_RUNNER_IMPORT, SPEC_RUNNER_IMPORT)


def render_spec(template: str, pack: str, safe: str, entries: list) -> str:
    spec = (
        template.replace("'__MATRIX_PACK__'", json.dumps(pack))
        .replace("'__MATRIX_SAFE__'", json.dumps(safe))
        .replace("'__MATRIX_ENTRIES__'", ', '.join(json.dumps(e) for e in entries))
        .replace('__MATRIX_PACK_DIR__', safe)
    )
    if '__MATRIX_' in spec:
        sys.exit(f'spec for {pack} kept an unsubstituted placeholder')
    return spec


def build(limit: int = 0, shard: str = ''):
    if not os.path.isdir(REPOS):
        sys.exit(f'corpus missing: {REPOS} - run fetch_corpus.py (or restore the cache) first')
    template = load_spec_template()
    runner = os.path.join(HERE, 'matrix_runner.ts')
    assert_runner_copy_depth(open(runner, encoding='utf-8').read())
    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    os.makedirs(os.path.join(DEST, 'packs'))
    shutil.copy(runner, os.path.join(DEST, 'runner.ts'))

    packs = sorted(os.listdir(REPOS))
    if shard:
        index, total = (int(v) for v in shard.split('/'))
        packs = [p for i, p in enumerate(packs) if i % total == index - 1]
    if limit:
        packs = packs[:limit]

    packs = [p for p in packs if os.path.isdir(os.path.join(REPOS, p))]
    safes = {pack: safe_name(pack) for pack in packs}
    clashing = {s for s, n in Counter(safes.values()).items() if n > 1}
    if clashing:
        colliding = sorted(p for p in packs if safes[p] in clashing)
        sys.exit(
            f'safe names collide for {len(colliding)} packs: {colliding} -'
            ' colliding packs overwrite each other and vanish from the census'
            ' without moving the rows-vs-specs count'
        )

    manifest = {}
    for pack in packs:
        src = os.path.join(REPOS, pack)
        safe = safes[pack]
        dst = os.path.join(DEST, 'packs', safe)
        candidates = []
        assisted = set()
        n_files = 0
        for root, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d not in SKIP]
            for f in files:
                lo = f.lower()
                is_vendored = any(v in lo for v in VEND) or '.min.js' in lo
                is_asset = lo.endswith(ASSETS) or (lo.endswith(JS) and is_vendored)
                if not (lo.endswith(JS) or is_asset):
                    continue
                fp = os.path.join(root, f)
                try:
                    if os.path.getsize(fp) > 2_000_000:
                        continue
                    if is_asset:
                        rel = os.path.relpath(fp, src)
                        out = os.path.join(dst, rel)
                        os.makedirs(os.path.dirname(out), exist_ok=True)
                        shutil.copy(fp, out)
                        continue
                    t = open(fp, encoding='utf-8', errors='ignore').read()
                except OSError:
                    continue

                rel = os.path.relpath(fp, src)
                out = os.path.join(dst, rel)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                for rx, rep in REWRITES:
                    t = rx.sub(rep, t)
                for label, rx, rep in PACK_REWRITES:
                    t, hits = rx.subn(rep, t)
                    if hits:
                        assisted.add(label)
                if '__PACKROOT__' in t:
                    anchor = packroot_anchor(src, dst, fp)
                    up = os.path.relpath(anchor, os.path.dirname(out)) or '.'
                    up = up if up.startswith('.') else './' + up
                    t = t.replace('__PACKROOT__', up)
                open(out, 'w', encoding='utf-8').write(t)
                n_files += 1
                if ENTRY_RX.search(t):
                    candidates.append(rel.replace(os.sep, '/'))
        candidates.sort()
        entries = [c for c in candidates if is_served(c)]
        # Nothing outside the unserved paths matched, so which files ComfyUI
        # would boot is a guess: run them, but keep the guess out of the rates.
        indeterminate = '' if entries else 'entries-unserved-only'
        entries = entries or candidates
        if len(entries) > ENTRY_CAP:
            indeterminate = 'entry-truncated'
            entries = entries[:ENTRY_CAP]
        if not entries:
            shutil.rmtree(dst, ignore_errors=True)
            manifest[pack] = {'skipped': 'no extension-shaped JS'}
            continue
        spec = render_spec(
            template, pack, safe, [f'./packs/{safe}/{e}' for e in entries]
        )
        open(
            os.path.join(DEST, f'{safe}.matrix.test.ts'), 'w', encoding='utf-8'
        ).write(spec)
        manifest[pack] = {
            'files': n_files,
            'entries': len(entries),
            'entryCandidates': len(candidates),
            'safe': safe,
        }
        if assisted:
            manifest[pack]['packSpecificRewrites'] = sorted(assisted)
        if indeterminate:
            manifest[pack]['indeterminate'] = indeterminate
    json.dump(
        manifest,
        open(os.path.join(DEST, 'manifest.json'), 'w', encoding='utf-8'),
        indent=1,
    )
    built = sum(1 for v in manifest.values() if 'entries' in v)
    helped = sum(1 for v in manifest.values() if v.get('packSpecificRewrites'))
    unsure = sum(1 for v in manifest.values() if v.get('indeterminate'))
    print(
        f'{built} pack specs built, {len(manifest)-built} skipped,'
        f' {helped} needed a pack-specific rewrite,'
        f' {unsure} indeterminate (excluded from rates) -> {DEST}',
        file=sys.stderr,
    )


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--limit', type=int, default=0, help='only N packs (smoke test)')
    ap.add_argument('--shard', default='', help='I/N: build only the I-th of N pack shards')
    args = ap.parse_args()
    build(args.limit, args.shard)
