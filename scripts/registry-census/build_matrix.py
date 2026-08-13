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
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from paths import CORPUS  # noqa: E402

DEST = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir, 'src', '__ecs_matrix__'))
REPOS = CORPUS

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
    (re.compile(r'(["\'])(?:\.\./)+rgthree/config\.js\1'), r'"__PACKROOT__/web/comfyui/config.js"'),
    (re.compile(r'(["\'])(?:\.\./)+rgthree/'), r'"__PACKROOT__/web/'),
]
ENTRY_RX = re.compile(r'registerExtension|registerNodeType|beforeRegisterNodeDef')
JS = ('.js', '.mjs')
ASSETS = ('.css', '.json', '.svg', '.woff2', '.png')
SKIP = {'.git', 'node_modules', 'vendor', '__pycache__', 'dist', 'venv'}
# runtime fixture: copy what the pack ships; exclude only true vendored bundles
VEND = ('three.min', 'jquery', 'codemirror', 'chart.min', 'd3.min',
        'litegraph.core', '.min.js', 'fabric.min', 'protobuf')

SPEC = """import {{ describe, it }} from 'vitest'

import {{ runPack }} from './runner'

const PACK = {pack_json}
const loaders = import.meta.glob('./packs/{safe}/**/*.{{js,mjs}}')

describe('matrix ' + PACK, () => {{
  it('runs the op battery', async () => {{
    await runPack(PACK, loaders, {entries}, '{safe}')
  }}, 300_000)
}})
"""


def build(limit: int = 0, shard: str = ''):
    if not os.path.isdir(REPOS):
        sys.exit(f'corpus missing: {REPOS} - run fetch_corpus.py (or restore the cache) first')
    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    os.makedirs(os.path.join(DEST, 'packs'))
    shutil.copy(os.path.join(HERE, 'matrix_runner.ts'), os.path.join(DEST, 'runner.ts'))

    packs = sorted(os.listdir(REPOS))
    if shard:
        index, total = (int(v) for v in shard.split('/'))
        packs = [p for i, p in enumerate(packs) if i % total == index - 1]
    if limit:
        packs = packs[:limit]

    manifest = {}
    seen_safe = set()
    for pack in packs:
        src = os.path.join(REPOS, pack)
        if not os.path.isdir(src):
            continue
        safe = re.sub(r'[^A-Za-z0-9_]', '_', pack)
        if safe in seen_safe:  # collision (e.g. was-ns vs was_ns)
            safe = f'{safe}_{len(seen_safe)}'
        seen_safe.add(safe)
        dst = os.path.join(DEST, 'packs', safe)
        entries = []
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
                if '__PACKROOT__' in t:
                    anchor = dst
                    probe = os.path.dirname(out)
                    while probe.startswith(dst):
                        if os.path.isdir(os.path.join(probe, 'web')):
                            anchor = probe
                            break
                        parent = os.path.dirname(probe)
                        if parent == probe:
                            break
                        probe = parent
                    up = os.path.relpath(anchor, os.path.dirname(out)) or '.'
                    up = up if up.startswith('.') else './' + up
                    t = t.replace('__PACKROOT__', up)
                open(out, 'w', encoding='utf-8').write(t)
                n_files += 1
                if ENTRY_RX.search(t):
                    entries.append('./packs/' + safe + '/' + rel.replace(os.sep, '/'))
        entries.sort()
        truncated = len(entries) > 60
        entries = entries[:60]
        if not entries:
            shutil.rmtree(dst, ignore_errors=True)
            manifest[pack] = {'skipped': 'no extension-shaped JS'}
            continue
        spec = SPEC.format(
            pack_json=json.dumps(pack), safe=safe, entries=json.dumps(entries)
        )
        open(
            os.path.join(DEST, f'{safe}.matrix.test.ts'), 'w', encoding='utf-8'
        ).write(spec)
        manifest[pack] = {'files': n_files, 'entries': len(entries)}
        if truncated:
            manifest[pack]['truncated'] = True
    json.dump(
        manifest,
        open(os.path.join(DEST, 'manifest.json'), 'w', encoding='utf-8'),
        indent=1,
    )
    built = sum(1 for v in manifest.values() if 'entries' in v)
    print(f'{built} pack specs built, {len(manifest)-built} skipped -> {DEST}', file=sys.stderr)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--limit', type=int, default=0, help='only N packs (smoke test)')
    ap.add_argument('--shard', default='', help='I/N: build only the I-th of N pack shards')
    args = ap.parse_args()
    build(args.limit, args.shard)
