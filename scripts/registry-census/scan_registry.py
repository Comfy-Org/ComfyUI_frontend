"""Full-registry ECS compatibility census.

Fetches frontend JS for EVERY registry pack with a repo URL (not a sample),
then scans for the empirically-confirmed ECS-breaking idioms.
Output: per-pack verdicts + true population counts (no extrapolation).
"""
import json, os, re, subprocess, sys, time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import CORPUS as OUT, RESULTS as BASE, registry_snapshot  # noqa: E402
os.makedirs(BASE, exist_ok=True)
allreg = json.load(open(registry_snapshot()))
targets = [x for x in allreg if x.get('repo')]

INC = " ".join(
    f"--include='*{e}'" for e in ('.js', '.mjs', '.ts', '.jsx', '.tsx', '.vue')
)


def slug_of(url):
    u = url.rstrip('/').replace('.git', '')
    parts = u.split('/')
    if len(parts) < 2:
        return None
    return '/'.join(parts[-2:])


def fetch(x):
    repo = x['repo']
    d = os.path.join(OUT, x['id'].replace('/', '_'))
    marker = os.path.join(d, '.done')
    if os.path.exists(marker):
        return (x['id'], 'cached')
    slug = slug_of(repo)
    if not slug:
        return (x['id'], 'badurl')
    os.makedirs(d, exist_ok=True)
    if 'github.com' in repo:
        hosts = [f'https://codeload.github.com/{slug}/tar.gz/HEAD']
    elif 'gitlab.com' in repo:
        hosts = [f'https://gitlab.com/{slug}/-/archive/HEAD/{slug.split("/")[-1]}-HEAD.tar.gz']
    else:
        return (x['id'], 'unsupported-host')
    for url in hosts:
        cmd = f"curl -sfL --max-time 120 {url} | tar -xz -C {d} {INC} 2>/dev/null"
        subprocess.run(cmd, shell=True)
        if any(True for _, _, fs in os.walk(d) for f in fs if f != '.done'):
            break
    open(marker, 'w').close()
    return (x['id'], 'ok')


if __name__ == '__main__':
    t0 = time.time()
    if not os.path.isdir(OUT):
        print('corpus not fetched — run `./run fetch` first', file=sys.stderr)
        raise SystemExit(2)

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
    for x in targets:
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

    TOT = sum(v['downloads'] for v in results.values())
    shipsjs = [v for v in results.values() if v['js_loc'] > 0]
    api = [v for v in results.values() if v['counts'].get('uses_api')]
    unc = [v for v in results.values() if any(v['counts'].get(k) for k in UNCOND)]
    vue = [v for v in results.values() if any(v['counts'].get(k) for k in VUE)]
    both = [v for v in results.values() if any(v['counts'].get(k) for k in {**UNCOND, **VUE})]
    n = len(results)
    print(f'\n=== FULL REGISTRY CENSUS (n={n} packs, {TOT:,} downloads) ===')
    for lbl, s in (('ships frontend JS', shipsjs), ('uses Comfy JS API', api),
                   ('UNCONDITIONAL break', unc), ('VUE-MODE break', vue),
                   ('ANY confirmed break', both)):
        print(f'{lbl:24s} {len(s):5d} packs ({len(s)/n*100:5.1f}%)   '
              f'{sum(v["downloads"] for v in s)/TOT*100:5.1f}% of registry downloads')
