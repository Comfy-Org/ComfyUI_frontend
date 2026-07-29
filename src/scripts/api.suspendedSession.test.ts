import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const mockIsSessionSuspended = vi.hoisted(() => vi.fn(() => false))
const mockGetAuthToken = vi.hoisted(() =>
  vi.fn((): Promise<string | null> => Promise.resolve(null))
)

// The short-circuit only exists on cloud builds.
vi.mock('@/platform/distribution/types', () => ({
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/platform/auth/session/sessionExpiry', () => ({
  isSessionSuspended: mockIsSessionSuspended
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isInitialized: true,
    getAuthHeader: () => Promise.resolve(null),
    getAuthToken: mockGetAuthToken
  })
}))

vi.stubGlobal('fetch', vi.fn())

const wsConstructed: string[] = []
class FakeWebSocket {
  static readonly CLOSED = 3
  readyState = 1
  private listeners: Record<string, (() => void)[]> = {}
  constructor(url: string) {
    wsConstructed.push(url)
    lastSocket = this
  }
  addEventListener(type: string, cb: () => void) {
    ;(this.listeners[type] ??= []).push(cb)
  }
  emit(type: string) {
    this.listeners[type]?.forEach((cb) => cb())
  }
  send() {}
  close() {}
}
let lastSocket: FakeWebSocket | undefined
vi.stubGlobal('WebSocket', FakeWebSocket)

describe('api.fetchApi on a suspended session', () => {
  beforeEach(() => {
    // Call history too, not just implementations: the entry-guard assertion
    // below is `not.toHaveBeenCalled()`, which any earlier case that reaches
    // the token lookup would otherwise decide.
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockReset()
    wsConstructed.length = 0
    // `reconnectSocket` returns early when a socket exists, so leaving one
    // behind lets a case assert against its predecessor's socket instead of
    // connecting at all.
    api.socket = null
    lastSocket = undefined
    mockGetAuthToken.mockResolvedValue(null)
    api.user = 'test-user'
  })

  it('short-circuits with a parseable 401 and never reaches the network', async () => {
    mockIsSessionSuspended.mockReturnValue(true)

    const response = await api.fetchApi('/jobs')

    expect(response.status).toBe(401)
    // Body-less would make unguarded .json() callers throw a SyntaxError, and a
    // bare `{}` normalizes to a null prompt error, so Run would record nothing,
    // render nothing, and still report success.
    await expect(response.json()).resolves.toMatchObject({
      error: { type: 'session_expired', message: expect.any(String) }
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('leaves a healthy session alone, so the app can still reach the network', async () => {
    mockIsSessionSuspended.mockReturnValue(false)
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('{"ok":true}', { status: 200 })
    )

    const response = await api.fetchApi('/jobs')

    // Without this direction, hard-wiring the guard on bricks every cloud
    // request and the whole suite still passes.
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })

  it('refuses the realtime socket while suspended, and opens it once resumed', async () => {
    mockIsSessionSuspended.mockReturnValue(true)

    await api.reconnectSocket()
    expect(wsConstructed).toHaveLength(0)
    // Refused before the token lookup, not after: a dead session must stop
    // asking the provider to mint a credential it cannot use.
    expect(mockGetAuthToken).not.toHaveBeenCalled()

    // Without the guard the close handler's retry reconnects behind the banner.
    mockIsSessionSuspended.mockReturnValue(false)
    await api.reconnectSocket()

    expect(wsConstructed).toHaveLength(1)
  })

  it('reconnects as a reconnect, so the reconnecting notice can be cleared', async () => {
    mockIsSessionSuspended.mockReturnValue(false)
    const reconnected = vi.fn()
    api.addEventListener('reconnected', reconnected)

    await api.reconnectSocket()
    expect(wsConstructed).toHaveLength(1)
    lastSocket?.emit('open')

    // Only `isReconnect` dispatches this, and it is the sole event that removes
    // the sticky "Reconnecting" toast raised by the close handler.
    expect(reconnected).toHaveBeenCalledTimes(1)
    api.removeEventListener('reconnected', reconnected)
  })

  it('abandons a connect when the session dies while it awaits its token', async () => {
    mockIsSessionSuspended.mockReturnValue(false)
    mockGetAuthToken.mockImplementation(() => {
      mockIsSessionSuspended.mockReturnValue(true)
      return Promise.resolve('token-from-a-session-about-to-die')
    })

    await api.reconnectSocket()

    // This is the ordinary path, not a rare race: authStore fires resetSocket
    // before it assigns currentUser, and the watcher that suspends runs off
    // that assignment, so an entry-only guard is always already past.
    expect(wsConstructed).toHaveLength(0)
  })
})
