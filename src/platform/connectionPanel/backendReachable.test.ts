import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isBackendReachable } from './backendReachable'

const STORAGE_KEY = 'comfyui-preview-backend-url'

const mockLocalStorage = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) delete store[key]
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    _store: store
  }
})

vi.stubGlobal('localStorage', mockLocalStorage)

function mockFetchOnce(impl: () => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('isBackendReachable', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  it('returns true when system_stats responds with a system field', async () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'http://127.0.0.1:8188')
    mockFetchOnce(
      () =>
        new Response(JSON.stringify({ system: { os: 'darwin' } }), {
          status: 200
        })
    )

    expect(await isBackendReachable()).toBe(true)
  })

  it('returns false when response is not ok', async () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'http://127.0.0.1:8188')
    mockFetchOnce(() => new Response('Not Found', { status: 404 }))

    expect(await isBackendReachable()).toBe(false)
  })

  it('returns false when response is HTML (no system field)', async () => {
    // Simulates a Cloudflare-style SPA fallback returning index.html
    mockLocalStorage.setItem(STORAGE_KEY, 'http://127.0.0.1:8188')
    mockFetchOnce(() => new Response(JSON.stringify({}), { status: 200 }))

    expect(await isBackendReachable()).toBe(false)
  })

  it('returns false when fetch rejects (network error / CORS / aborted)', async () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'http://127.0.0.1:8188')
    mockFetchOnce(() => Promise.reject(new Error('network')))

    expect(await isBackendReachable()).toBe(false)
  })

  it('strips trailing slashes from the configured backend URL', async () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'http://127.0.0.1:8188///')
    const fetchSpy = vi.fn(
      () =>
        new Response(JSON.stringify({ system: { os: 'linux' } }), {
          status: 200
        })
    )
    vi.stubGlobal('fetch', fetchSpy)

    await isBackendReachable()

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8188/api/system_stats',
      expect.any(Object)
    )
  })

  it('falls back to same-origin when no backend URL is configured', async () => {
    const fetchSpy = vi.fn(
      () =>
        new Response(JSON.stringify({ system: { os: 'linux' } }), {
          status: 200
        })
    )
    vi.stubGlobal('fetch', fetchSpy)

    await isBackendReachable()

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/system_stats',
      expect.any(Object)
    )
  })
})
