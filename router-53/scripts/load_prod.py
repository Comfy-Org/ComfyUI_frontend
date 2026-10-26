# Rebuild the PUBLIC prod catalog (cloud.comfy.org/api/v1/catalog) in the local catalog-api
# through its own authoring path: profiles -> content create -> verified media upload -> content
# replace -> checked final review -> publish. Usage: load_prod.py <items_dir>... [--limit N]
import json, os, re, sys, glob, threading, uuid, urllib.request, urllib.error, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from cat import call, state, BASE

Q = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROD = 'https://cloud.comfy.org'
CACHE = os.path.join(Q, 'media-cache'); os.makedirs(CACHE, exist_ok=True)
LOG = open(os.path.join(Q, 'logs', 'load.jsonl'), 'a')
loglock = threading.Lock()
def log(**kw):
    with loglock: LOG.write(json.dumps(kw) + '\n'); LOG.flush()

args = [a for a in sys.argv[1:] if not a.startswith('--')]
limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
if limit: args = [a for a in args if a != str(limit)]
files = sorted(f for d in args for f in glob.glob(os.path.join(d, '*.json')))
items = [json.load(open(f))['data'] for f in files][:limit]
if '--slugs' in sys.argv:
    want = set(open(sys.argv[sys.argv.index('--slugs') + 1]).read().split())
    items = [d for d in items if d['slug'] in want]
    args = [a for a in args if not a.endswith('.txt')]

EXT = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm',
       'audio/mpeg': 'mp3', 'application/json': 'json', 'image/gif': 'gif'}

def is_ref(x): return isinstance(x, dict) and 'id' in x and x.get('src') in ('r2', 'media') and set(x) <= {'id', 'src', 'file_version_uid', 'name'}

def ref_key(ref, path, d):
    if ref.get('file_version_uid'): return (ref['id'], ref['file_version_uid'])
    m = re.match(r'^/catalog-media/([0-9a-f-]{36})/([0-9a-f-]{36})$', (d.get('website_media') or {}).get(path, ''))
    return (m.group(1), m.group(2)) if m and m.group(1) == ref['id'] else (ref['id'], None)

def refs(x, path='$'):
    if is_ref(x): yield path, x; return
    if isinstance(x, dict):
        for k, v in x.items(): yield from refs(v, f'{path}.{k}')
    elif isinstance(x, list):
        for i, v in enumerate(x): yield from refs(v, f'{path}[{i}]')

def strip_refs(x):
    if isinstance(x, dict): return {k: strip_refs(v) for k, v in x.items() if not is_ref(v)}
    if isinstance(x, list): return [strip_refs(v) for v in x if not is_ref(v)]
    return x

def remap(x, m, path='$', d=None):
    if is_ref(x):
        loc = m.get(ref_key(x, path, d or {}))
        if loc is None: return None
        return {**x, 'id': loc[0], 'file_version_uid': loc[1]} if 'file_version_uid' in x else {**x, 'id': loc[0]}
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            r = remap(v, m, f'{path}.{k}', d)
            if r is None and is_ref(v): continue
            out[k] = r
        return out
    if isinstance(x, list):
        return [r for r in (remap(v, m, f'{path}[{i}]', d) for i, v in enumerate(x)) if not (r is None)]
    return x

def download(mid, ver):
    p = os.path.join(CACHE, f'{mid}_{ver}')
    if os.path.exists(p) and os.path.exists(p + '.type'): return p, open(p + '.type').read()
    try:
        with urllib.request.urlopen(f'{PROD}/api/v1/catalog/media/{mid}/{ver}', timeout=300) as r:
            data = r.read(); ctype = r.headers.get_content_type()
    except urllib.error.HTTPError as e:
        return None, f'http {e.code}'
    open(p, 'wb').write(data); open(p + '.type', 'w').write(ctype)
    return p, ctype

def multipart(fields, fname, ctype, data):
    b = uuid.uuid4().hex; out = []
    for k, v in fields.items():
        out.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    out.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b'\r\n')
    out.append(f'--{b}--\r\n'.encode())
    return b''.join(out), f'multipart/form-data; boundary={b}'

media_map, media_locks, mlock = {}, {}, threading.Lock()
EXISTING = {}
for line in open(os.path.join(Q, 'logs', 'load.jsonl')):
    e = json.loads(line)
    if e['event'] in ('loaded', 'replace-failed'): EXISTING[e['slug']] = e['uid']
    if e['event'] == 'media-map': media_map[tuple(e['key'])] = tuple(e['local'])
def safe(s): return re.sub(r'[^a-z0-9._-]+', '-', s.lower()).strip('-.') or 'file'

def upload(key, path, ref, slug, origin, draft):
    with mlock: lk = media_locks.setdefault(key, threading.Lock())
    with lk:
        if key in media_map: return media_map[key]
        p, ctype = download(*key)
        if p is None:
            log(event='media-missing', key=key, slug=slug, path=path, why=ctype); media_map[key] = None; return None
        role = 'workflow-api-v1' if path.endswith('.api') else safe(re.sub(r'\[\d+\]', '', path.lstrip('$.')).replace('.', '-'))
        stem = safe(os.path.splitext(os.path.basename(ref['name']))[0]) if ref.get('name') else role
        base = f'{stem}.{EXT.get(ctype, "bin")}'
        body, ct = multipart({'expected_draft_rev': draft, 'originating_entity_uid': origin, 'role': role, 'name': f'{safe(slug)}/{base}'},
                             base, ctype, open(p, 'rb').read())
        st, res = call('POST', '/api/v1/catalog/draft/media', raw=body, ctype=ct)
        if st != 201:
            log(event='media-upload-failed', key=key, slug=slug, path=path, status=st, res=str(res)[:400]); media_map[key] = None; return None
        media_map[key] = (res['uid'], res['revision_uid'])
        log(event='media-map', key=key, local=media_map[key])
        return media_map[key]

def drop_path(doc, path):
    toks = re.findall(r'\["([^"]*)"\]|\[(\d+)\]|\.?([^.\[\]]+)', path.lstrip('$'))
    parts = [a if a else int(b) if b else (int(c) if c.isdigit() else c) for a, b, c in toks]
    cur = doc
    for k in parts[:-1]:
        cur = cur[k]
    if isinstance(cur, list): cur.pop(parts[-1])
    else: del cur[parts[-1]]

def save_v2(method, url, body, dropped):
    for _ in range(25):
        st, res = call(method, url, body)
        errs = (res or {}).get('field_errors') if isinstance(res, dict) and res.get('code') == 'invalid_document' else None
        if st < 300 or not errs: return st, res
        progressed = False
        for e in errs:
            if e['path'] in ('$', '$.slug'): continue
            target = e['path']
            if 'required field is missing' in e['message'] or target in dropped:
                target = '$.' + re.findall(r'^\$\.([^.\[]+)', e['path'])[0]
                if target in dropped or target in ('$.slug', '$.title', '$.type', '$.visibility', '$.enabled', '$.available_surfaces'): continue
            try: drop_path(body, target); dropped.append(target); progressed = True
            except (KeyError, IndexError, TypeError): pass
        if not progressed: return st, res
    return st, res

def load(d, draft):
    slug = d['slug']
    full = {k: v for k, v in d.items() if not k.startswith('website_') and k != 'uid'}
    if slug in EXISTING:
        uid = EXISTING[slug]
        st, cur = call('GET', f'/api/v1/catalog/draft/items/{uid}')
        for drop in ('generation_type', 'sort_order'):
            if drop in full and drop not in cur: full.pop(drop)
        have = dict(refs(cur))
        for path, ref in refs(full):
            if path in have:
                with mlock: media_map.setdefault(ref_key(ref, path, d), (have[path]['id'], have[path].get('file_version_uid')))
        created = {'uid': uid, 'revision_uid': cur['revision_uid']}
        return finish(d, full, created, draft)
    dropped = []
    original = json.loads(json.dumps(full))
    for drop in (None, 'generation_type', 'sort_order'):
        if drop and drop in full: full.pop(drop); dropped.append(drop)
        st, created = call('POST', '/api/v1/catalog/draft/items', {**{k: v for k, v in full.items() if not any(True for _ in refs(v))}, 'expected_draft_rev': draft})
        if not (st == 400 and isinstance(created, dict) and created.get('code') == 'invalid_request'): break
    if st == 400 and isinstance(created, dict) and created.get('code') == 'invalid_request' and full.get('schema_version') == 1:
        full = original; full['schema_version'] = 2; dropped = ['schema_version 1->2']
        body = {**{k: v for k, v in full.items() if not any(True for _ in refs(v))}, 'expected_draft_rev': draft}
        st, created = save_v2('POST', '/api/v1/catalog/draft/items', body, dropped)
        for p in dropped:
            if p.startswith('$.'):
                try: drop_path(full, p)
                except (KeyError, IndexError, TypeError): pass
    if dropped: log(event='dropped-fields', slug=slug, fields=dropped)
    if st != 201:
        log(event='create-failed', slug=slug, status=st, res=str(created)[:600]); return None
    return finish(d, full, created, draft)

def finish(d, full, created, draft):
    slug = d['slug']; uid = created['uid']
    for path, ref in refs(full):
        key = ref_key(ref, path, d)
        if key[1] is None: log(event='media-unresolved', slug=slug, path=path); continue
        upload(key, path, ref, slug, uid, draft)
    doc = remap(full, media_map, '$', d)
    put_dropped = []
    st, saved = save_v2('PUT', f'/api/v1/catalog/draft/items/{uid}', {**doc, 'expected_draft_rev': draft, 'expected_revision_uid': created['revision_uid']}, put_dropped)
    if put_dropped: log(event='dropped-fields-put', slug=slug, fields=put_dropped)
    if st != 200:
        log(event='replace-failed', slug=slug, uid=uid, status=st, res=str(saved)[:800]); return uid
    log(event='loaded', slug=slug, uid=uid, prod_uid=d['uid'], type=d['type'])
    return uid

def profiles():
    seen = {}
    for d in items:
        a = d.get('website_author') or {}
        if a.get('username'): seen[a['uid']] = a
    for uid, a in seen.items():
        with urllib.request.urlopen(f'{PROD}/api/v1/catalog/creators/{a["username"]}', timeout=60) as r: p = json.load(r)
        body = {'username': p['username'], 'display_name': p['display_name'], 'description': p.get('bio') or ''}
        if p.get('links'): body['website_urls'] = [l['url'] if isinstance(l, dict) else l for l in p['links']][:8]
        st, res = call('POST', f'/api/v1/catalog/profiles/{uid}', body)
        log(event='profile', username=p['username'], status=st, res=str(res)[:300])
        print('profile', p['username'], st)

if __name__ == '__main__':
    profiles()
    draft = state()['draft_rev']
    with cf.ThreadPoolExecutor(6) as ex: uids = list(ex.map(lambda d: load(d, draft), items))
    print('items', len(items), 'loaded uids', sum(1 for u in uids if u), 'media', sum(1 for v in media_map.values() if v), 'media missing/failed', sum(1 for v in media_map.values() if v is None))
