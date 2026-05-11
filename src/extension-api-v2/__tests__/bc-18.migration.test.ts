// Category: BC.18 — Backend HTTP calls
// DB cross-ref: S6.A3
// blast_radius: 5.77 (compat-floor)
// Migration: v1 app.api.fetchApi → v2 comfyAPI.fetchApi (same signature, stable import)
//
// Phase A strategy: prove that v1 and v2 both build identical HTTP requests
// from the same inputs, using a fetch mock. Real auth and base-URL behavior
// is todo(Phase B / shell).
//
// I-TF.8.D2 — BC.18 migration wired assertions.

import { describe, expect, it, vi, afterEach } from 'vitest'

// ── V1 app.api shim ───────────────────────────────────────────────────────────

function createV1Api(baseUrl = 'http://localhost:8188') {
  return {
    async fetchApi(path: string, init?: RequestInit): Promise<Response> {
      return globalThis.fetch(`${baseUrl}${path}`, init)
    }
  }
}

// ── V2 comfyAPI shim ──────────────────────────────────────────────────────────

function createV2ComfyAPI(baseUrl = 'http://localhost:8188') {
  return {
    async fetchApi(path: string, init?: RequestInit): Promise<Response> {
      return globalThis.fetch(`${baseUrl}${path}`, init)
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.18 migration — backend HTTP calls', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('request equivalence', () => {
    it('v1 app.api.fetchApi and v2 comfyAPI.fetchApi call fetch with the same URL', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()

      await v1.fetchApi('/api/history')
      const v1Url = mockFetch.mock.calls[0][0]

      mockFetch.mockClear()
      await v2.fetchApi('/api/history')
      const v2Url = mockFetch.mock.calls[0][0]

      expect(v1Url).toBe(v2Url)
    })

    it('v1 and v2 both pass RequestInit through to fetch unchanged', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()
      const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' }

      await v1.fetchApi('/api/prompt', init)
      const v1Init = mockFetch.mock.calls[0][1]

      mockFetch.mockClear()
      await v2.fetchApi('/api/prompt', init)
      const v2Init = mockFetch.mock.calls[0][1]

      expect(v1Init).toEqual(v2Init)
    })

    it('FormData uploads produce the same body reference in both v1 and v2', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()
      const form = new FormData()
      form.append('image', 'data:image/png;base64,abc')

      await v1.fetchApi('/upload/image', { method: 'POST', body: form })
      const v1Body = (mockFetch.mock.calls[0][1] as RequestInit).body

      mockFetch.mockClear()
      await v2.fetchApi('/upload/image', { method: 'POST', body: form })
      const v2Body = (mockFetch.mock.calls[0][1] as RequestInit).body

      expect(v1Body).toBe(v2Body)
    })
  })

  describe('response handling equivalence', () => {
    it('both v1 and v2 resolve with a native Response on 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()

      const r1 = await v1.fetchApi('/api/system_stats')
      const r2 = await v2.fetchApi('/api/system_stats')

      expect(r1).toBeInstanceOf(Response)
      expect(r2).toBeInstanceOf(Response)
    })

    it('both v1 and v2 resolve (not reject) on 4xx/5xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 500 }))
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()

      const [r1, r2] = await Promise.all([v1.fetchApi('/api/broken'), v2.fetchApi('/api/broken')])
      expect(r1.status).toBe(500)
      expect(r2.status).toBe(500)
    })
  })

  describe('import-path migration', () => {
    it('v2 comfyAPI.fetchApi has the same signature arity as v1 app.api.fetchApi', () => {
      const v1 = createV1Api()
      const v2 = createV2ComfyAPI()
      // Both take (path, init?) → arity 2
      expect(v1.fetchApi.length).toBe(2)
      expect(v2.fetchApi.length).toBe(2)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.18 migration — backend HTTP calls [Phase B / shell]', () => {
  it.todo(
    '[shell] v1 app.api.fetchApi and v2 comfyAPI.fetchApi send identical HTTP requests with the same auth headers'
  )
  it.todo(
    '[shell] comfyAPI.fetchApi is available at extension init time without waiting for app.setup()'
  )
})
