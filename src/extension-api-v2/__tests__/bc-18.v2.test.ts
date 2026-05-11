// Category: BC.18 — Backend HTTP calls
// DB cross-ref: S6.A3
// blast_radius: 5.77 (compat-floor)
// v2 replacement: comfyAPI.fetchApi(path, opts) — same signature, same auth, stable import
//
// Phase A strategy: prove the fetchApi surface contract using a fetch mock
// (globalThis.fetch replaced by vi.fn). Real base-URL/auth behavior needs
// the shell. Import-path stability and signature shape can be tested today.
//
// I-TF.8.D2 — BC.18 v2 wired assertions.

import { describe, expect, it, vi, afterEach } from 'vitest'

// ── Synthetic fetchApi (mirrors the real shell's contract) ────────────────────
// In the real extension API, comfyAPI.fetchApi prepends the server base URL
// and adds auth headers. Here we prove the shape contract only.

function createFetchApiStub(baseUrl = 'http://localhost:8188') {
  async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    return globalThis.fetch(url, init)
  }
  return { fetchApi }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.18 v2 contract — comfyAPI.fetchApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('API surface shape', () => {
    it('fetchApi is a function with signature (path: string, init?: RequestInit) => Promise<Response>', () => {
      const { fetchApi } = createFetchApiStub()
      expect(typeof fetchApi).toBe('function')
      expect(fetchApi.length).toBe(2) // path + init
    })

    it('fetchApi returns a Promise', () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }))
      const { fetchApi } = createFetchApiStub()
      const result = fetchApi('/api/history')
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('request construction', () => {
    it('fetchApi prepends the base URL when given a relative path', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
      const { fetchApi } = createFetchApiStub('http://localhost:8188')
      await fetchApi('/api/history')
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8188/api/history', undefined)
    })

    it('fetchApi passes RequestInit options through to fetch', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
      const { fetchApi } = createFetchApiStub()
      const init: RequestInit = { method: 'POST', body: JSON.stringify({ key: 'val' }), headers: { 'Content-Type': 'application/json' } }
      await fetchApi('/api/prompt', init)
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), init)
    })

    it('fetchApi resolves with the Response object returned by fetch', async () => {
      const mockResponse = new Response('{"status":"ok"}', { status: 200, headers: { 'Content-Type': 'application/json' } })
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse)
      const { fetchApi } = createFetchApiStub()
      const response = await fetchApi('/api/system_stats')
      expect(response).toBe(mockResponse)
    })
  })

  describe('non-2xx response handling', () => {
    it('fetchApi resolves (does not reject) on 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      const { fetchApi } = createFetchApiStub()
      const response = await fetchApi('/api/missing')
      expect(response.status).toBe(404)
      expect(response.ok).toBe(false)
    })

    it('fetchApi resolves (does not reject) on 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      const { fetchApi } = createFetchApiStub()
      const response = await fetchApi('/api/broken')
      expect(response.status).toBe(500)
    })
  })

  describe('FormData body support', () => {
    it('fetchApi accepts a FormData body and passes it to fetch unchanged', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 200 }))
      const { fetchApi } = createFetchApiStub()
      const form = new FormData()
      form.append('filename', 'test.png')
      await fetchApi('/upload/image', { method: 'POST', body: form })
      const callInit = fetchMock.mock.calls[0][1] as RequestInit
      expect(callInit.body).toBe(form)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.18 v2 contract — comfyAPI.fetchApi [Phase B / shell]', () => {
  it.todo(
    '[shell] comfyAPI.fetchApi is importable from @comfyorg/extension-api without accessing app.api'
  )
  it.todo(
    '[shell] fetchApi uses the same base URL and authentication headers as v1 app.api.fetchApi'
  )
  it.todo(
    '[shell] fetchApi is available at extension init time without waiting for app.setup() to complete'
  )
})
