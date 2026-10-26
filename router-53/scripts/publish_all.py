# Publish every pending Draft change through the checked publication path:
# staging page (all pending uids) -> POST final-review (digest) -> POST publish.
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from cat import call, state

uids, cursor = [], None
while True:
    q = '/api/v1/catalog/draft/staging?representation=page&limit=100' + (f'&cursor={cursor}' if cursor else '')
    st, r = call('GET', q)
    assert st == 200, (st, r)
    uids += [i['content']['uid'] for i in r['items']]
    cursor = (r.get('page') or {}).get('next_cursor')
    if not cursor: break
s = state()
review = {'expected_live_rev': s['live_rev'], 'expected_draft_rev': s['draft_rev'], 'expected_draft_generation': s['draft_generation']}
print('pending', len(uids), 'state', s)
st, fr = call('POST', '/api/v1/catalog/draft/final-review', {'review': review, 'selected_uids': uids})
if st != 200:
    print('final-review', st, json.dumps(fr)[:3000]); sys.exit(1)
st, pub = call('POST', '/api/v1/catalog/draft/publish', {'review': review, 'expected_selection_digest': fr['selection_digest'], 'selected_uids': uids})
print('publish', st, json.dumps(pub)[:3000])
sys.exit(0 if st == 200 else 1)
