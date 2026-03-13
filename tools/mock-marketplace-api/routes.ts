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
