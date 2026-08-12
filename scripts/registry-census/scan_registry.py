"""Full-registry ECS compatibility census.

Scans the fetched corpus (fetch_corpus.py) of every registry pack's frontend
JS for the empirically-confirmed ECS-breaking idioms.
Output: per-pack verdicts + true population counts (no extrapolation).
Packs the fetcher could not deliver (failed / bad-url / unsupported-host /
never fetched) are EXCLUDED from the scanned population and reported as
their own line - an unscannable pack is unknown, never clean.
"""
import json, os, re, sys, time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import CORPUS as OUT, RESULTS as BASE, registry_snapshot  # noqa: E402
os.makedirs(BASE, exist_ok=True)
if not os.path.exists(registry_snapshot()):
    print(f'missing registry snapshot: {registry_snapshot()}', file=sys.stderr)
    print('run refresh_registry.py first', file=sys.stderr)
    raise SystemExit(2)
allreg = json.load(open(registry_snapshot()))
targets = [x for x in allreg if x.get('repo')]



if __name__ == '__main__':
    t0 = time.time()
    if not os.path.isdir(OUT):
        print('corpus not fetched — run fetch_corpus.py first', file=sys.stderr)
        raise SystemExit(2)

    # The .done marker is written only after a successful fetch+extract, so
    # marker-on-disk is the fetch-status ground truth - failed, bad-url,
    # unsupported-host and never-fetched packs have none and are excluded
    # from the scanned population instead of reading as clean.
    def fetched(x):
        return os.path.exists(
            os.path.join(OUT, x['id'].replace('/', '_'), '.done')
        )

    scannable = [x for x in targets if fetched(x)]
    unfetched = [x for x in targets if not fetched(x)]

    # ---- the empirically-confirmed ECS-breaking idioms (see report Part II) ----
    UNCOND = {
        'out_links_write': r'\.\s*links\s*(?:=(?!=)|\.push\s*\(|\.splice\s*\(|\.pop\s*\(|\.unshift\s*\()',
        'in_link_write': r'(?<![\w.])(?:inputs?\s*\[[^\]]*\]|input|slot)\s*\.\s*link\s*=(?!=)',
        'slot_spread': r'\{\s*\.\.\.\s*(?:input|output|slot)\w*\s*[,}]',
        'type_write_nodevar': r'(?<![\w.])(?:node|[a-z]\w*[nN]ode)\s*\.\s*type\s*=(?!=)',
        'node_shape_write': r'(?<![\w.])(?:node|this)\s*\.\s*shape\s*=(?!=)',
        'link_endpoint_write': r'\.\s*(?:origin_id|origin_slot|target_id|target_slot)\s*=(?!=)',
    }
    VUE = {
        'widgets_splice': r'\.\s*widgets\s*\.\s*splice\s*\(',
        'widgets_assign': r'\.\s*widgets\s*=(?!=)',
        'widgets_push': r'\.\s*widgets\s*\.\s*push\s*\(',
        'widgets_len_zero': r'\.\s*widgets\s*\.\s*length\s*=\s*0',
        'converted_widget': r'origType|origComputeSize|origSerializeValue|CONVERTED_TYPE|converted-widget',
        'widget_type_write': r'(?<![\w.])(?:widget|w)\s*\.\s*type\s*=(?!=)',
        'hook_getCustomWidgets': r'getCustomWidgets\s*[:(]',
    }
    CTX = {  # context / denominators
        'uses_api': r'app\.registerExtension\s*\(|scripts/app\.js|comfyAPI|\bLiteGraph\b|\bLGraphNode\b',
        'ships_js': r'.',
    }
    RX = {k: re.compile(v) for k, v in {**UNCOND, **VUE, **CTX}.items()}

    SKIP = {'.git', 'node_modules', 'vendor', 'dist', '__pycache__'}
    VEND = ('three.min', 'jquery', 'codemirror', 'chart.min', 'd3.min',
            'litegraph.core', 'litegraph.js', '.min.js', 'fabric.min')
    dl = {x['id']: (x.get('downloads') or 0) for x in allreg}
    results = {}
    for x in scannable:
        d = os.path.join(OUT, x['id'].replace('/', '_'))
        counts = defaultdict(int)
        loc = 0
        for root, dirs, files in os.walk(d):
            dirs[:] = [q for q in dirs if q not in SKIP]
            for f in files:
                lo = f.lower()
                if not lo.endswith(('.js', '.mjs', '.ts', '.jsx', '.tsx', '.vue')):
                    continue
                if any(h in lo for h in VEND):
                    continue
                fp = os.path.join(root, f)
                try:
                    if os.path.getsize(fp) > 2_000_000:
                        continue
                    txt = open(fp, encoding='utf-8', errors='ignore').read()
                except OSError:
                    continue
                if txt.count('\n') < 4 and len(txt) > 20000:
                    continue
                loc += txt.count('\n')
                for line in txt.split('\n'):
                    if len(line) > 400:
                        continue
                    for k, rx in RX.items():
                        if k == 'ships_js':
                            continue
                        n = len(rx.findall(line))
                        if n:
                            counts[k] += n
        results[x['id']] = {
            'downloads': dl.get(x['id'], 0),
            'js_loc': loc,
            'counts': dict(counts),
        }
    json.dump(results, open(os.path.join(BASE, 'registry_scan.json'), 'w'))

    if not results:
        print('no scannable packs: the lockfile records no successful fetch', file=sys.stderr)
        raise SystemExit(2)
    TOT = sum(v['downloads'] for v in results.values()) or 1
    shipsjs = [v for v in results.values() if v['js_loc'] > 0]
    api = [v for v in results.values() if v['counts'].get('uses_api')]
    unc = [v for v in results.values() if any(v['counts'].get(k) for k in UNCOND)]
    vue = [v for v in results.values() if any(v['counts'].get(k) for k in VUE)]
    both = [v for v in results.values() if any(v['counts'].get(k) for k in {**UNCOND, **VUE})]
    n = len(results)
    reg_dl = sum(dl.values()) or 1
    print(f'\n=== FULL REGISTRY CENSUS (n={n} scanned packs, {TOT:,} downloads) ===')
    print(
        f'{"unscannable (excluded)":24s} {len(unfetched):5d} packs   '
        f'{sum(dl.get(x["id"], 0) for x in unfetched) / reg_dl * 100:5.1f}% of registry downloads '
        f'(failed/bad-url/unsupported/never fetched - unknown, not clean)'
    )
    for lbl, s in (('ships frontend JS', shipsjs), ('uses Comfy JS API', api),
                   ('UNCONDITIONAL break', unc), ('VUE-MODE break', vue),
                   ('ANY confirmed break', both)):
        print(f'{lbl:24s} {len(s):5d} packs ({len(s)/n*100:5.1f}%)   '
              f'{sum(v["downloads"] for v in s)/TOT*100:5.1f}% of registry downloads')
