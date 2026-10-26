# Content cross-references (model_uids, workflow_uid, ...) carry prod UIDs; swap them for the local UIDs.
import json, os, sys, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from cat import call, state
Q = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ev = [json.loads(l) for l in open(os.path.join(Q, 'logs', 'load.jsonl'))]
m = {e['prod_uid']: e['uid'] for e in ev if e['event'] == 'loaded'}
local = {e['slug']: e['uid'] for e in ev if e['event'] == 'loaded'}
def sub(x):
    if isinstance(x, str): return m.get(x, x)
    if isinstance(x, dict): return {k: sub(v) for k, v in x.items()}
    if isinstance(x, list): return [sub(v) for v in x]
    return x
draft = state()['draft_rev']
def fix(uid):
    st, cur = call('GET', f'/api/v1/catalog/draft/items/{uid}')
    new = sub(cur)
    if new == cur: return 0
    st, r = call('PUT', f'/api/v1/catalog/draft/items/{uid}', {**new, 'expected_draft_rev': draft, 'expected_revision_uid': cur['revision_uid']})
    if st != 200: print('fail', uid, st, str(r)[:300])
    return 1
with cf.ThreadPoolExecutor(6) as ex: print('remapped', sum(ex.map(fix, set(local.values()))))
