# New-site pages, untouched paths and the sitemap index, all through the local router.
# Usage: page_checks.py <prod-items-dir> <prod-creators.json> <out.csv>
import csv, glob, json, os, random, sys, re, http.client, concurrent.futures as cf
items_dir, creators_json, out_csv = sys.argv[1:4]
H, P = '127.0.0.1', 8771

def get(path):
    c = http.client.HTTPConnection(H, P, timeout=120)
    c.request('GET', path, headers={'User-Agent': 'routing-qa', 'Accept': 'text/html'})
    r = c.getresponse(); body = r.read(); c.close()
    return r.status, r.getheader('Location') or '', r.getheader('x-comfy-content-source') or '', r.getheader('X-Served-By') or '', body

random.seed(53)
items = [json.load(open(f))['data'] for f in glob.glob(os.path.join(items_dir, '*.json'))]
wf = sorted(d['slug'] for d in items if d['type'] == 'workflow')
apps = sorted(d['slug'] for d in items if d['type'] == 'app')
creators = sorted(c['username'] for c in json.load(open(creators_json)))
checks = []
for p in ['/hub/workflows/', '/hub/models/', '/hub/apps/', '/hub/creators/']:
    checks.append(('hub index', p))
for loc in ('zh-CN', 'ja'):
    for p in ['/hub/workflows/', '/hub/models/', '/hub/apps/', '/hub/creators/']:
        checks.append((f'hub index {loc}', f'/{loc}{p}'))
for u in creators:
    checks.append(('creator profile', f'/hub/creators/{u}/'))
    checks.append(('creator profile zh-CN', f'/zh-CN/hub/creators/{u}/'))
for s in random.sample(wf, 50):
    checks.append(('workflow detail', f'/hub/workflows/{s}/'))
for s in random.sample(wf, 10):
    checks.append(('workflow detail zh-CN', f'/zh-CN/hub/workflows/{s}/'))
    checks.append(('workflow detail ja', f'/ja/hub/workflows/{s}/'))
for s in apps:
    checks.append(('app detail', f'/hub/apps/{s}/'))
for p in ['/', '/pricing', '/models', '/cloud', '/download']:
    checks.append(('untouched', p))
for p in ['/workflows/download/0f5f5bc82df5.json', '/workflows/thumbnails/image.webp', '/workflows/og/template.png']:
    checks.append(('old-site asset', p))
checks.append(('sitemap', '/sitemap-index.xml'))

def run(c):
    kind, path = c
    st, loc, src, served, body = get(path)
    row = {'check': kind, 'path': path, 'status': st, 'location': loc, 'x_comfy_content_source': src, 'served_by': served, 'note': ''}
    if kind.startswith(('hub', 'creator', 'workflow', 'app')):
        row['ok'] = st == 200 and src == 'cms'
        if b'/workflows/' in body and re.search(rb'(?:href|content)="(?:https?://[^/"]+)?/workflows/', body):
            row['note'] = 'links to /workflows/'
    elif kind == 'sitemap':
        locs = re.findall(rb'<loc>([^<]+)</loc>', body)
        row['note'] = ' '.join(l.decode() for l in locs)
        row['ok'] = st == 200 and not any(b'workflows' in l for l in locs)
    elif kind == 'old-site asset':
        row['ok'] = served == 'vercel-workflows' and not loc
    else:
        row['ok'] = st < 500 and '/hub/' not in loc
    return row

with cf.ThreadPoolExecutor(6) as ex: rows = list(ex.map(run, checks))
with open(out_csv, 'w', newline='') as f:
    w = csv.DictWriter(f, list(rows[0].keys())); w.writeheader(); w.writerows(rows)
import collections
print(collections.Counter((r['check'], r['ok']) for r in rows))
for r in rows:
    if not r['ok'] or r['check'] in ('untouched', 'old-site asset', 'sitemap') or r['note']: print(r)
