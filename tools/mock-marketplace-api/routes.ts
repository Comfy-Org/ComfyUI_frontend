import type {
  CreateTemplateRequest,
  TemplateStatus
} from '../../src/platform/marketplace/apiTypes'

import {
  addMedia,
  createTemplate,
  findTemplate,
  getDb,
  transitionStatus,
  updateTemplate
} from './state'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const REVIEW_UI_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Marketplace Review UI</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 1rem; text-align: left; }
    th { background: #f0f0f0; }
    tr.pending { background: #fff9e6; }
    .status { font-weight: 600; }
    .status.pending_review { color: #b8860b; }
    .status.approved { color: #22863a; }
    .status.published { color: #17a2b8; }
    .status.rejected { color: #cb2431; }
    button { margin-right: 0.5rem; padding: 0.25rem 0.75rem; cursor: pointer; }
    button.approve { background: #28a745; color: white; border: none; }
    button.reject { background: #dc3545; color: white; border: none; }
    button.publish { background: #28a745; color: white; border: none; }
    button.unpublish { background: #6c757d; color: white; border: none; }
    button.reset { background: #6c757d; color: white; border: none; margin-bottom: 1rem; }
    #error { color: #cb2431; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Marketplace Review UI</h1>
  <p>Temp UI for testing approve/reject workflow flow.</p>
  <button class="reset" onclick="resetDb()">Reset DB</button>
  <div id="error"></div>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Title</th>
        <th>Status</th>
        <th>Author</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="templates"></tbody>
  </table>
  <script>
    const base = '';
    async function load() {
      try {
        const r = await fetch(base + '/api/marketplace/author/templates');
        const { templates } = await r.json();
        document.getElementById('error').textContent = '';
        const tbody = document.getElementById('templates');
        tbody.innerHTML = templates.map(t => {
          const rowClass = t.status === 'pending_review' ? ' class="pending"' : '';
          let actions = '';
          if (t.status === 'pending_review') {
            actions = '<button class="approve" data-id="' + escapeHtml(t.id) + '">Approve</button>' +
              '<button class="reject" data-id="' + escapeHtml(t.id) + '">Reject</button>';
          } else if (t.status === 'published') {
            actions = '<button class="unpublish" data-id="' + escapeHtml(t.id) + '">Unpublish</button>';
          } else if (t.status === 'approved' || t.status === 'unpublished') {
            actions = '<button class="publish" data-id="' + escapeHtml(t.id) + '">Publish</button>';
          }
          return '<tr' + rowClass + '><td>' + t.id + '</td><td>' + escapeHtml(t.title) +
            '</td><td><span class="status ' + t.status + '">' + t.status + '</span></td>' +
            '<td>' + escapeHtml(t.author?.name ?? '') + '</td><td>' + actions + '</td></tr>';
        }).join('');
        tbody.querySelectorAll('button.approve').forEach(btn => {
          btn.addEventListener('click', () => approve(btn.dataset.id));
        });
        tbody.querySelectorAll('button.reject').forEach(btn => {
          btn.addEventListener('click', () => reject(btn.dataset.id));
        });
        tbody.querySelectorAll('button.unpublish').forEach(btn => {
          btn.addEventListener('click', () => unpublish(btn.dataset.id));
        });
        tbody.querySelectorAll('button.publish').forEach(btn => {
          btn.addEventListener('click', () => publish(btn.dataset.id));
        });
      } catch (e) {
        document.getElementById('error').textContent = 'Error: ' + e.message;
      }
    }
    function escapeHtml(s) {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }
    async function approve(id) {
      const r = await fetch(base + '/api/marketplace/templates/' + id + '/approve', { method: 'POST' });
      const data = await r.json();
      if (data.error) document.getElementById('error').textContent = data.error;
      else load();
    }
    async function reject(id) {
      const r = await fetch(base + '/api/marketplace/templates/' + id + '/reject', { method: 'POST' });
      const data = await r.json();
      if (data.error) document.getElementById('error').textContent = data.error;
      else load();
    }
    async function unpublish(id) {
      const r = await fetch(base + '/api/marketplace/templates/' + id + '/unpublish', { method: 'POST' });
      const data = await r.json();
      if (data.error) document.getElementById('error').textContent = data.error;
      else load();
    }
    async function publish(id) {
      const r = await fetch(base + '/api/marketplace/templates/' + id + '/publish', { method: 'POST' });
      const data = await r.json();
      if (data.error) document.getElementById('error').textContent = data.error;
      else load();
    }
    async function resetDb() {
      await fetch(base + '/api/marketplace/_reset', { method: 'POST' });
      load();
    }
    load();
  </script>
</body>
</html>`

function extractIdFromPath(
  pathname: string,
  prefix: string
): string | undefined {
  const rest = pathname.slice(prefix.length)
  const segments = rest.split('/').filter(Boolean)
  return segments[0]
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { pathname } = url
  const method = req.method

  // POST /api/marketplace/templates
  if (method === 'POST' && pathname === '/api/marketplace/templates') {
    const body = (await req.json()) as Partial<CreateTemplateRequest>

    if (!body.title || !body.description || !body.shortDescription) {
      return json(
        { error: 'title, description, and shortDescription are required' },
        400
      )
    }

    const template = createTemplate(body as CreateTemplateRequest)
    return json({ id: template.id, status: template.status }, 201)
  }

  // PUT /api/marketplace/templates/:id
  if (
    method === 'PUT' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    const body = await req.json()
    const updated = updateTemplate(id, body)
    if (!updated) return json({ error: 'Template not found' }, 404)

    return json(updated)
  }

  // POST /api/marketplace/templates/:id/submit
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/submit$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    return handleTransition(id, 'pending_review')
  }

  // POST /api/marketplace/templates/:id/approve
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/approve$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    return handleTransition(id, 'approved')
  }

  // POST /api/marketplace/templates/:id/reject
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/reject$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    return handleTransition(id, 'rejected')
  }

  // POST /api/marketplace/templates/:id/publish
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/publish$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    return handleTransition(id, 'published')
  }

  // POST /api/marketplace/templates/:id/unpublish
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/unpublish$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    return handleTransition(id, 'unpublished')
  }

  // POST /api/marketplace/templates/:id/media
  if (
    method === 'POST' &&
    pathname.match(/^\/api\/marketplace\/templates\/[^/]+\/media$/)
  ) {
    const id = extractIdFromPath(pathname, '/api/marketplace/templates/')
    if (!id) return json({ error: 'Missing template id' }, 400)

    if (!findTemplate(id)) {
      return json({ error: 'Template not found' }, 404)
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return json({ error: 'No file provided' }, 400)
    }

    const media = addMedia(id, file.type, file.name)
    if (!media) return json({ error: 'Template not found' }, 404)

    return json(media, 201)
  }

  // GET /api/marketplace/author/templates
  if (method === 'GET' && pathname === '/api/marketplace/author/templates') {
    return json({ templates: getDb().templates })
  }

  // GET /api/marketplace/author/stats
  if (method === 'GET' && pathname === '/api/marketplace/author/stats') {
    return json(getDb().authorStats)
  }

  // GET /api/marketplace/categories
  if (method === 'GET' && pathname === '/api/marketplace/categories') {
    return json({ categories: getDb().categories })
  }

  // GET /api/marketplace/tags/suggest
  if (method === 'GET' && pathname === '/api/marketplace/tags/suggest') {
    const query = url.searchParams.get('query') ?? ''
    const allTags = getDb().suggestedTags
    const filtered = query
      ? allTags.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
      : allTags

    return json({ tags: filtered })
  }

  // POST /api/marketplace/_reset (dev helper)
  if (method === 'POST' && pathname === '/api/marketplace/_reset') {
    const { resetDb } = await import('./state')
    resetDb()
    return json({ ok: true })
  }

  // GET /review (temp UI for testing approve/reject flow)
  if (method === 'GET' && pathname === '/review') {
    return new Response(REVIEW_UI_HTML, {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return json({ error: 'Not found' }, 404)
}

function handleTransition(id: string, to: TemplateStatus): Response {
  const result = transitionStatus(id, to)
  if (!result.ok) {
    const template = findTemplate(id)
    if (!template) return json({ error: 'Template not found' }, 404)
    return json({ error: result.error }, 400)
  }

  return json({ status: to })
}
