# Every old /workflows URL through the local router, followed to the end, classified against an
# oracle built from the PROD catalog records (not from the router).
# Usage: routing_test.py <redirect-map.csv> <prod-items-dir> <prod-creators.json> <out.csv>
# Env: ROUTER (default http://127.0.0.1:8771), CONC (<=6), CHUNK (router restart interval), RESTART (script)
import csv, json, glob, os, re, sys, subprocess, random, collections, http.client, urllib.parse
import concurrent.futures as cf

ROUTER = os.environ.get('ROUTER', 'http://127.0.0.1:8771')
CONC = min(int(os.environ.get('CONC', '6')), 6)
CHUNK = int(os.environ.get('CHUNK', '1200'))
RESTART = os.environ.get('RESTART')
map_csv, items_dir, creators_json, out_csv = sys.argv[1:5]
R = urllib.parse.urlsplit(ROUTER)

# ---- oracle from prod records ----
SECTION = {'workflow': '/hub/workflows/', 'app': '/hub/apps/', 'model': '/hub/models/'}
SUF = re.compile(r'-([0-9a-f]{12})$')
SHARE = re.compile(r'(?:^|-)([0-9a-f]{12})$')
by_sid, by_slug = collections.defaultdict(set), {}
for f in glob.glob(os.path.join(items_dir, '*.json')):
    d = json.load(open(f))['data']
    if d['type'] not in ('workflow', 'app'): continue
    path = SECTION[d['type']] + d['slug'] + '/'
    by_slug[d['slug']] = path
    m = SUF.search(d['slug'])
    if m: by_sid[m.group(1)].add(path)
    m = re.search(r'[?&]share=([0-9a-f]{12})(?:[&#]|$)', d.get('cloud_share_url') or '')
    if m: by_sid[m.group(1)].add(path)
creators = {c['username'] for c in json.load(open(creators_json))}
def slugify(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')

def oracle(kind, old_path, map_new):
    """-> (expected_path_or_query, basis)"""
    base = kind.replace('locale:', '')
    seg = [s for s in re.split(r'/(?:workflows|templates)/', old_path, 1)[-1].split('?')[0].split('/') if s]
    if base in ('detail-named', 'detail-hexhex', 'legacy-bare-name', 'profile', 'other') and len(seg) == 1:
        name = seg[0]
        m = SHARE.search(name.lower())
        if m:
            hit = by_sid.get(m.group(1), set())
            if len(hit) == 1: return next(iter(hit)), 'share-id'
            return '/hub/workflows/', 'ambiguous share id' if hit else 'no catalog record for share id'
        if base == 'profile' or name in creators:
            return ('/hub/creators/%s/' % name, 'creator') if name in creators else ('/hub/workflows/', 'no catalog creator')
        s = slugify(name)
        if s in by_slug: return by_slug[s], 'template name'
        return '/hub/workflows/', 'bare template name, no catalog record'
    if map_new:
        u = urllib.parse.urlsplit(map_new)
        return u.path + ('?' + u.query if u.query else ''), 'vocabulary'
    return None, 'untouched'

# ---- HTTP ----
def hop(path):
    for attempt in range(3):
        try:
            c = http.client.HTTPConnection(R.hostname, R.port, timeout=90)
            c.request('GET', path, headers={'User-Agent': 'routing-qa', 'Accept': 'text/html'})
            r = c.getresponse(); r.read(); c.close()
            return r.status, r.getheader('Location'), r.getheader('Cache-Control'), r.getheader('x-comfy-content-source')
        except Exception as e:
            err = str(e)[:80]
    return 'ERR', err, None, None

def rel(loc, cur):
    u = urllib.parse.urlsplit(urllib.parse.urljoin(ROUTER + cur, loc))
    return u.path + ('?' + u.query if u.query else ''), u.netloc

def run(row):
    path = row['path']; chain = []; first = None; seen = set()
    for _ in range(6):
        st, loc, cc, src = hop(path)
        if first is None: first = (st, loc or '', cc or '')
        chain.append(f'{st} {path}')
        if st in (301, 302, 303, 307, 308) and loc:
            nxt, host = rel(loc, path)
            if nxt in seen or len(chain) > 5:
                return {**row, 'first_status': first[0], 'first_location': first[1], 'first_cache_control': first[2], 'hops': len(chain), 'final_status': 'LOOP', 'final_path': nxt, 'final_source': '', 'chain': ' > '.join(chain)}
            seen.add(path); path = nxt
            if host and host != R.netloc:
                return {**row, 'first_status': first[0], 'first_location': first[1], 'first_cache_control': first[2], 'hops': len(chain), 'final_status': f'offsite {host}', 'final_path': path, 'final_source': '', 'chain': ' > '.join(chain)}
            continue
        return {**row, 'first_status': first[0], 'first_location': first[1], 'first_cache_control': first[2], 'hops': len(chain) - 1, 'final_status': st, 'final_path': path, 'final_source': src or '', 'chain': ' > '.join(chain)}
    return {**row, 'first_status': first[0], 'first_location': first[1], 'first_cache_control': first[2], 'hops': len(chain), 'final_status': 'TOO-MANY-HOPS', 'final_path': path, 'final_source': '', 'chain': ' > '.join(chain)}

def norm(p): return urllib.parse.unquote(p.split('?')[0].rstrip('/')) or '/'
def query(p): return sorted(urllib.parse.parse_qsl(p.split('?', 1)[1])) if '?' in p else []

def classify(r):
    st, fp, exp, basis = r['final_status'], r['final_path'], r['expected'], r['basis']
    if st != 200: return 'broken', f'final {st}'
    if basis == 'untouched': return 'untouched', ''
    extra = query(r['path'])
    want_q = query(exp) + [q for q in extra if q not in query(exp)]
    if norm(fp) == norm(exp) and sorted(query(fp)) == sorted(want_q):
        if basis in ('share-id', 'template name', 'creator'): return 'exact page', basis
        if norm(exp) == '/hub/workflows' and not query(exp):
            return ('generic list fallback', basis) if basis != 'vocabulary' else ('list (map target)', 'vocabulary')
        return 'right filtered list', basis
    if norm(fp) == '/hub/workflows' and not [q for q in query(fp) if q not in extra]:
        return 'generic list fallback', f'expected {exp} ({basis})'
    return 'mismatch', f'expected {exp} ({basis})'

# ---- rows ----
rows = []
for r in csv.DictReader(open(map_csv)):
    if r['kind'].startswith('pattern:'): continue
    u = urllib.parse.urlsplit(r['old_url'])
    p = u.path + ('?' + u.query if u.query else '')
    rows.append({'form': 'map', 'kind': r['kind'], 'path': p, 'map_new': r['new_url']})
random.seed(53)
det = [x for x in rows if x['kind'] in ('detail-named', 'detail-hexhex', 'legacy-bare-name')]
tags = [x for x in rows if x['kind'] in ('tag', 'model', 'category')]
for x in random.sample(det, 20) + random.sample(tags, 6):
    rows.append({**x, 'form': 'query', 'path': x['path'] + '?utm_source=qa&ref=router-test'})
for x in random.sample(det, 10) + random.sample(tags, 4):
    rows.append({**x, 'form': 'templates', 'path': x['path'].replace('/workflows/', '/templates/', 1)})
for x in random.sample(det, 6):
    rows.append({**x, 'form': 'locale-templates', 'kind': 'locale:' + x['kind'], 'path': '/ja' + x['path'].replace('/workflows/', '/templates/', 1)})
for x in rows:
    x['expected'], x['basis'] = oracle(x['kind'], x['path'], x['map_new'])

out = []
if '--reclassify' in sys.argv:
    prev = {(r['form'], r['path']): r for r in csv.DictReader(open(out_csv))}
    for x in rows: out.append({**prev[(x['form'], x['path'])], 'expected': x['expected'], 'basis': x['basis']})
    rows = []
for i in range(0, len(rows), CHUNK):
    if RESTART and i: subprocess.run([RESTART], check=True, capture_output=True)
    with cf.ThreadPoolExecutor(CONC) as ex: out += list(ex.map(run, rows[i:i + CHUNK]))
    print(f'{min(i + CHUNK, len(rows))}/{len(rows)}', flush=True)
for r in out:
    r['final_status'] = int(r['final_status']) if str(r['final_status']).isdigit() else r['final_status']
    r['class'], r['reason'] = classify(r)
    r.setdefault('rerun_class', '')
retry = [r for r in out if r['class'] == 'generic list fallback' and r['basis'] == 'share-id']
for r in retry:
    again = run({k: r[k] for k in ('form', 'kind', 'path', 'map_new', 'expected', 'basis')})
    again['final_status'] = again['final_status']
    r['rerun_class'] = classify(again)[0] + ' -> ' + again['final_path']
print('serial rerun of share-id fallbacks:', collections.Counter(r['rerun_class'].split(' -> ')[0] for r in retry))
cols = ['form', 'kind', 'path', 'first_status', 'first_location', 'first_cache_control', 'hops', 'final_status', 'final_path', 'final_source', 'expected', 'basis', 'class', 'reason', 'chain', 'map_new', 'rerun_class']
with open(out_csv, 'w', newline='') as f:
    w = csv.DictWriter(f, cols); w.writeheader(); [w.writerow({k: r.get(k, '') for k in cols}) for r in out]
print(collections.Counter(r['class'] for r in out))
