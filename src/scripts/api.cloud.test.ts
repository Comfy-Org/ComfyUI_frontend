import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchWithUnifiedRemint,
  shouldRemintCloudRequest
} from '@/platform/auth/unified/remintRetry'

const { mockAuthStore } = vi.hoisted(() => ({
  mockAuthStore: {
    isInitialized: true,
    getAuthHeader: vi.fn(),
    getAuthToken: vi.fn()
  }
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

vi.mock('@/platform/auth/unified/remintRetry', () => ({
  fetchWithUnifiedRemint: vi.fn(),
  shouldRemintCloudRequest: vi.fn()
}))

class FakeWebSocket extends EventTarget {
  static instances: FakeWebSocket[] = []

  binaryType = ''
  sent: string[] = []

  constructor(readonly url: string) {
    super()
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.dispatchEvent(new Event('close'))
  }
}

const { ComfyApi } = await import('./api')

describe('ComfyApi cloud mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    FakeWebSocket.instances = []
    window.name = ''
    sessionStorage.clear()
    mockAuthStore.isInitialized = true
    mockAuthStore.getAuthHeader.mockResolvedValue(null)
    mockAuthStore.getAuthToken.mockResolvedValue(null)
    vi.mocked(shouldRemintCloudRequest).mockResolvedValue(false)
    vi.mocked(fetchWithUnifiedRemint).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds cloud auth headers and enables unified retry for authenticated requests', async () => {
    mockAuthStore.getAuthHeader.mockResolvedValue({
      Authorization: 'Bearer firebase-token'
    })
    vi.mocked(shouldRemintCloudRequest).mockResolvedValue(true)
    const api = new ComfyApi()
    api.user = 'cloud-user'

    await api.fetchApi('/queue')

    expect(api.api_base).toBe('')
    expect(fetchWithUnifiedRemint).toHaveBeenCalledWith(
      '/api/queue',
      expect.objectContaining({
        cache: 'no-cache',
        headers: {
          Authorization: 'Bearer firebase-token',
          'Comfy-User': 'cloud-user'
        }
      }),
      true
    )
  })

  it('continues cloud fetches when auth header lookup fails', async () => {
    mockAuthStore.getAuthHeader.mockRejectedValue(new Error('auth unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = new ComfyApi()

    await api.fetchApi('/history', {
      headers: [['X-Test', '1']]
    })

    const [, options, retryOn401] = vi.mocked(fetchWithUnifiedRemint).mock
      .calls[0]
    expect(options.headers).toEqual([
      ['X-Test', '1'],
      ['Comfy-User', '']
    ])
    expect(retryOn401).toBe(false)
    expect(shouldRemintCloudRequest).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'Failed to get auth header:',
      expect.any(Error)
    )
  })

  it('adds the cloud auth token to websocket URLs', async () => {
    mockAuthStore.getAuthToken.mockResolvedValue('socket-token')
    window.name = 'client-1'
    const api = new ComfyApi()

    api.init()

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })
    const socket = FakeWebSocket.instances[0]

    expect(socket.url).toContain('clientId=client-1')
    expect(socket.url).toContain('token=socket-token')
  })

  it('opens a cloud websocket without a token when token lookup fails', async () => {
    mockAuthStore.getAuthToken.mockRejectedValue(new Error('token unavailable'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = new ComfyApi()

    api.init()

    await vi.waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1)
    })
    const socket = FakeWebSocket.instances[0]

    expect(socket.url).not.toContain('token=')
    expect(warn).toHaveBeenCalledWith(
      'Could not get auth token for WebSocket connection:',
      expect.any(Error)
    )
  })
})
