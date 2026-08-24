import { describe, expect, it, vi } from 'vitest'

import {
  markdownTwinPath,
  NEGOTIATION_BYPASS_HEADER,
  negotiateAgentContent
} from './content-negotiation'

const ORIGIN = 'https://website-frontend-comfyui.vercel.app'

function fetchRouting(routes: Record<string, number>) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input))
    const status = routes[url.pathname] ?? 404
    return new Response(status === 404 ? 'not here' : `body:${url.pathname}`, {
      status
    })
  })
}

function request(
  path: string,
  init: { accept?: string; method?: string; bypass?: boolean } = {}
): Request {
  const headers = new Headers()
  if (init.accept !== undefined) headers.set('accept', init.accept)
  if (init.bypass) headers.set(NEGOTIATION_BYPASS_HEADER, '1')
  return new Request(new URL(path, ORIGIN), {
    method: init.method ?? 'GET',
    headers
  })
}

describe('markdownTwinPath', () => {
  it('maps the root to /index.md', () => {
    expect(markdownTwinPath('/')).toBe('/index.md')
  })

  it('maps pages with and without trailing slashes', () => {
    expect(markdownTwinPath('/api')).toBe('/api.md')
    expect(markdownTwinPath('/api/')).toBe('/api.md')
    expect(markdownTwinPath('/cloud/pricing')).toBe('/cloud/pricing.md')
  })

  it('leaves .md paths alone', () => {
    expect(markdownTwinPath('/api.md')).toBe('/api.md')
  })
})

describe('negotiateAgentContent', () => {
  it('passes browsers through without any subrequests', async () => {
    const fetchImpl = fetchRouting({})
    const chrome =
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    const result = await negotiateAgentContent(
      request('/', { accept: chrome }),
      fetchImpl
    )
    expect(result).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('passes requests without an Accept header through', async () => {
    const fetchImpl = fetchRouting({})
    const result = await negotiateAgentContent(request('/'), fetchImpl)
    expect(result).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rewrites to the markdown twin when markdown is preferred', async () => {
    const fetchImpl = fetchRouting({ '/index.md': 200 })
    const result = await negotiateAgentContent(
      request('/', { accept: 'text/markdown' }),
      fetchImpl
    )
    expect(result?.headers.get('x-middleware-rewrite')).toBe(
      `${ORIGIN}/index.md`
    )
    expect(result?.headers.get('vary')).toBe('Accept')
    expect(result?.headers.get('content-location')).toBe('/index.md')
    const [, init] = fetchImpl.mock.calls[0] ?? []
    expect(init?.method).toBe('HEAD')
  })

  it('lets the platform answer redirect-source paths', async () => {
    const fetchImpl = fetchRouting({ '/developers': 307 })
    const result = await negotiateAgentContent(
      request('/developers', { accept: 'text/markdown' }),
      fetchImpl
    )
    expect(result).toBeUndefined()
  })

  it('marks its subrequests with the bypass header', async () => {
    const fetchImpl = fetchRouting({ '/index.md': 200 })
    await negotiateAgentContent(
      request('/', { accept: 'text/markdown' }),
      fetchImpl
    )
    const [, init] = fetchImpl.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get(NEGOTIATION_BYPASS_HEADER)).toBe('1')
  })

  it('falls back to HTML when no twin exists but the page does', async () => {
    const fetchImpl = fetchRouting({ '/cloud': 200 })
    const result = await negotiateAgentContent(
      request('/cloud', { accept: 'text/markdown, text/html;q=0.5' }),
      fetchImpl
    )
    expect(result).toBeUndefined()
  })

  it('returns 406 when only markdown is acceptable and none exists', async () => {
    const fetchImpl = fetchRouting({ '/cloud': 200 })
    const result = await negotiateAgentContent(
      request('/cloud', { accept: 'text/markdown' }),
      fetchImpl
    )
    expect(result?.status).toBe(406)
    expect(result?.headers.get('vary')).toBe('Accept')
    expect(result?.headers.get('cache-control')).toBe('no-store')
    const body = await result?.text()
    expect(body).toContain('text/html')
    expect(body).toContain('text/markdown')
    expect(body).toContain('You requested: text/markdown')
  })

  it('returns 406 immediately for unsupported-only Accept values', async () => {
    const fetchImpl = fetchRouting({})
    const result = await negotiateAgentContent(
      request('/', { accept: 'application/pdf' }),
      fetchImpl
    )
    expect(result?.status).toBe(406)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('serves the markdown 404 for nonexistent paths', async () => {
    const fetchImpl = fetchRouting({ '/404.md': 200 })
    const result = await negotiateAgentContent(
      request('/no-such-page', { accept: 'text/markdown' }),
      fetchImpl
    )
    expect(result?.status).toBe(404)
    expect(result?.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8'
    )
    expect(result?.headers.get('content-location')).toBe('/404.md')
    expect(await result?.text()).toBe('body:/404.md')
  })

  it('rewrites HEAD requests the same way as GET', async () => {
    const fetchImpl = fetchRouting({ '/index.md': 200 })
    const result = await negotiateAgentContent(
      request('/', { accept: 'text/markdown', method: 'HEAD' }),
      fetchImpl
    )
    expect(result?.headers.get('x-middleware-rewrite')).toBe(
      `${ORIGIN}/index.md`
    )
  })

  it('ignores non-GET/HEAD methods', async () => {
    const fetchImpl = fetchRouting({})
    const result = await negotiateAgentContent(
      request('/', { accept: 'text/markdown', method: 'POST' }),
      fetchImpl
    )
    expect(result).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ignores its own subrequests', async () => {
    const fetchImpl = fetchRouting({ '/index.md': 200 })
    const result = await negotiateAgentContent(
      request('/', { accept: 'text/markdown', bypass: true }),
      fetchImpl
    )
    expect(result).toBeUndefined()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
