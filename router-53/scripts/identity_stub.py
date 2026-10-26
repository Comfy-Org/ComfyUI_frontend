# Local-only stand-in for ingest's /api/internal/catalog-identity: every caller is one staff account.
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, parse_qs
STAFF = sys.argv[2]
class H(BaseHTTPRequestHandler):
    def _reply(self):
        u = urlsplit(self.path)
        if u.path != '/api/internal/catalog-identity': self.send_response(404); self.end_headers(); return
        body = {'id': STAFF, 'method': 'firebase', 'expires_at': '2099-01-01T00:00:00Z'}
        if 'account_id' in parse_qs(u.query): body['account_exists'] = True
        b = json.dumps(body).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    do_GET = do_POST = _reply
    def log_message(self, *a): pass
ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
