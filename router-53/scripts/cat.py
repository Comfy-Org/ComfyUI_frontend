import json, uuid, urllib.request, urllib.error
BASE='http://127.0.0.1:18471'
def call(method, path, body=None, headers=None, raw=None, ctype='application/json'):
    h={'Authorization':'Bearer local-qa','Idempotency-Key':str(uuid.uuid4())}
    h.update(headers or {})
    data=None
    if raw is not None: data=raw; h['Content-Type']=ctype
    elif body is not None: data=json.dumps(body).encode(); h['Content-Type']='application/json'
    req=urllib.request.Request(BASE+path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return r.status, json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code, json.loads(b)
        except Exception: return e.code, b[:500].decode('utf8','replace')
def state(): return call('GET','/api/v1/catalog/state')[1]
