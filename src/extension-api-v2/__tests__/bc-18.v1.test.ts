// Category: BC.18 — Backend HTTP calls
// DB cross-ref: S6.A3
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/components/common/BackgroundImageUpload.vue#L61
// blast_radius: 5.77 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v1 contract: app.api.fetchApi('/endpoint', { method: 'POST', body: ... })

import { describe, expect, it, vi } from 'vitest'

// ── Minimal fetchApi shim ─────────────────────────────────────────────────────
// Models the v1 pattern: app.api.fetchApi(path, init) = fetch(baseUrl + path, init)
// No real HTTP calls. Synthetic stub proves the structural contract.

function createFetchApi(baseUrl: string) {
  return {
    async fetchApi(path: string, init?: RequestInit): Promise<Response> {
      const url = baseUrl + path
      return fetch(url, init)
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.18 v1 contract — app.api.fetchApi', () => {
  describe('S6.A3 — authenticated HTTP calls via fetchApi (synthetic)', () => {
    it('fetchApi prepends the base URL so callers use relative paths', async () => {
      const captured: { url: string; init?: RequestInit }[] = []
      global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        captured.push({ url: String(url), init })
        return new Response('{}', { status: 200 })
      }) as typeof fetch

      const api = createFetchApi('http://localhost:8188')
      await api.fetchApi('/upload/image', { method: 'POST' })

      expect(captured[0].url).toBe('http://localhost:8188/upload/image')
    })

    it('fetchApi passes init options (method, body) through to fetch unchanged', async () => {
      const captured: { init?: RequestInit }[] = []
      global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured.push({ init })
        return new Response('{}', { status: 200 })
      }) as typeof fetch

      const formData = new FormData()
      formData.append('file', new Blob(['data'], { type: 'image/png' }), 'test.png')

      const api = createFetchApi('http://localhost:8188')
      await api.fetchApi('/upload/image', { method: 'POST', body: formData })

      expect(captured[0].init?.method).toBe('POST')
      expect(captured[0].init?.body).toBe(formData)
    })

    it('a non-2xx response is returned as resolved Promise — callers must check response.ok', async () => {
      global.fetch = vi.fn(async () => new Response('Not Found', { status: 404 })) as typeof fetch

      const api = createFetchApi('http://localhost:8188')
      const response = await api.fetchApi('/nonexistent')

      // v1 contract: does NOT reject on 4xx — callers check response.ok
      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })

    it('concurrent fetchApi calls return independent Response objects', async () => {
      let callCount = 0
      global.fetch = vi.fn(async (url: RequestInfo | URL) => {
        callCount++
        const n = callCount
        return new Response(JSON.stringify({ n }), { status: 200 })
      }) as typeof fetch

      const api = createFetchApi('http://localhost:8188')
      const [r1, r2] = await Promise.all([
        api.fetchApi('/endpoint/a'),
        api.fetchApi('/endpoint/b')
      ])

      const d1: { n: number } = await r1.json()
      const d2: { n: number } = await r2.json()

      // Both resolved independently — different call counts
      expect(d1.n).not.toBe(d2.n)
    })

    it('extension can pass Authorization header inside init', async () => {
      const captured: { headers?: HeadersInit }[] = []
      global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured.push({ headers: init?.headers })
        return new Response('{}', { status: 200 })
      }) as typeof fetch

      const api = createFetchApi('http://localhost:8188')
      await api.fetchApi('/queue', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' }
      })

      const hdrs = captured[0].headers as Record<string, string>
      expect(hdrs['Authorization']).toBe('Bearer test-token')
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'fetchApi includes ComfyUI session cookie automatically when the browser session is authenticated (Phase B — requires real browser session)'
    )
  })
})
