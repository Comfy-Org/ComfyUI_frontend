import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { ComfyApi } from './ComfyApi'
import type { ComfyApiPorts } from './ComfyApi'
import { anonymousApiAuthProvider } from './apiAuthProvider'
import type { AuthTokenRequest } from './apiAuthProvider'
import { provideWebSessionRequests } from './webSessionFetch'
import type { WebSessionRequests } from './webSessionFetch'

const ports: ComfyApiPorts = {
  isCloud: true,
  featureFlagOverride: () => undefined,
  onFreeMemory: () => {}
}

const RECONNECT_WINDOW_MS = 60_000

class FakeWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = 0
  binaryType = ''
  send = vi.fn()
  handlers: Record<string, (event: unknown) => void> = {}
  addEventListener = vi.fn(
    (event: string, handler: (event: unknown) => void) => {
      this.handlers[event] = handler
    }
  )
  close = vi.fn(() => this.serverClose(1006, ''))

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.handlers['open']?.(new Event('open'))
  }

  serverClose(code: number, reason: string) {
    this.readyState = FakeWebSocket.CLOSED
    this.handlers['close']?.(new CloseEvent('close', { code, reason }))
  }
}

const latestSocket = () => FakeWebSocket.instances.at(-1)!

function sessionRequests(
  refreshSession: () => Promise<void>
): WebSessionRequests {
  const scope = {
    session: {
      user: { id: 'user', email: 'user@example.com', emailVerified: true },
      csrfToken: 'csrf',
      expiresAt: Number.MAX_SAFE_INTEGER,
      absoluteExpiresAt: Number.MAX_SAFE_INTEGER
    },
    epoch: 1
  }
  return {
    refreshSession,
    scope: async () => scope,
    workspaceId: () => undefined,
    send: async () => new Response(),
    ingestHeaders: async () => ({}),
    workspaceToken: async () => ({
      status: 'error',
      code: 'NO_SESSION',
      retryable: false
    }),
    remintWorkspaceToken: async () => ({
      status: 'error',
      code: 'NO_SESSION',
      retryable: false
    }),
    authorizeResource: async () => ({})
  }
}

describe('ComfyApi realtime socket after a revoked credential', () => {
  let api: ComfyApi
  let mintableToken: string | undefined
  const getAuthToken = vi.fn(
    async (_request?: AuthTokenRequest) => mintableToken
  )
  const onRevokedSocketEnded = vi.fn()

  const forcedRefreshCount = () =>
    getAuthToken.mock.calls.filter(([request]) => request?.forceRefresh).length

  async function revokeOpenSocket(reason = 'auth_revoked') {
    latestSocket().simulateOpen()
    latestSocket().serverClose(1008, reason)
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
  }

  beforeEach(async () => {
    FakeWebSocket.instances = []
    mintableToken = 'token'
    getAuthToken.mockClear()
    onRevokedSocketEnded.mockClear()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    api = new ComfyApi(ports)
    api.setAuthProvider({ ...anonymousApiAuthProvider, getAuthToken })
    api.addEventListener('revokedSocketEnded', onRevokedSocketEnded)
    await api.resetSocket()
  })

  it('force-refreshes the credential exactly once for the next attempt', async () => {
    await revokeOpenSocket()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(forcedRefreshCount()).toBe(1)
    expect(getAuthToken).toHaveBeenLastCalledWith({ forceRefresh: true })
  })

  it('keeps force-refreshing while refreshed attempts close before open', async () => {
    await revokeOpenSocket()

    for (let attempt = 0; attempt < 5; attempt++) {
      latestSocket().serverClose(1006, '')
      await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
    }

    expect(FakeWebSocket.instances).toHaveLength(7)
    expect(forcedRefreshCount()).toBe(6)
    expect(api.socket).toBe(latestSocket())
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()
  })

  it('recovers when a refreshed attempt opens after a transient close', async () => {
    await revokeOpenSocket()

    latestSocket().serverClose(1006, '')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
    latestSocket().simulateOpen()

    expect(api.socket).toBe(latestSocket())
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()
  })

  it('stops reconnecting when a refreshed socket that opened is revoked again', async () => {
    await revokeOpenSocket()
    await revokeOpenSocket()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(api.socket).toBeNull()
    expect(onRevokedSocketEnded).toHaveBeenCalledOnce()
  })

  it('resumes normal reconnects once the refreshed attempt opens', async () => {
    await revokeOpenSocket()

    latestSocket().simulateOpen()
    latestSocket().serverClose(1006, '')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
    latestSocket().serverClose(1006, '')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(4)
    expect(forcedRefreshCount()).toBe(1)
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()
  })

  it.for([
    { code: 1008, reason: 'auth_expired' },
    { code: 1008, reason: 'max_lifetime' },
    { code: 1006, reason: '' }
  ])(
    'keeps reconnecting after a $code $reason close',
    async ({ code, reason }) => {
      latestSocket().simulateOpen()
      latestSocket().serverClose(code, reason)
      await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
      latestSocket().serverClose(1006, '')
      await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

      expect(FakeWebSocket.instances).toHaveLength(3)
      expect(forcedRefreshCount()).toBe(0)
      expect(onRevokedSocketEnded).not.toHaveBeenCalled()
    }
  )

  it('opens no tokenless socket and keeps retrying while the refreshed credential cannot be minted', async () => {
    latestSocket().simulateOpen()
    mintableToken = undefined
    latestSocket().serverClose(1008, 'auth_revoked')
    await vi.advanceTimersByTimeAsync(5 * RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(forcedRefreshCount()).toBeGreaterThanOrEqual(5)
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()

    mintableToken = 'token'
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(latestSocket().url).toContain('token=token')
  })

  it('reconnects when a refreshed credential is minted after a failed mint', async () => {
    latestSocket().simulateOpen()
    getAuthToken.mockResolvedValueOnce(undefined)
    latestSocket().serverClose(1008, 'auth_revoked')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(forcedRefreshCount()).toBe(2)
    expect(latestSocket().url).toContain('token=token')
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()
  })

  it('keeps refreshing the web session of a revoked session socket that cannot open', async () => {
    const refreshSession = vi.fn(async () => {})
    onTestFinished(provideWebSessionRequests(sessionRequests(refreshSession)))
    await api.resetSocket()

    await revokeOpenSocket()
    for (let attempt = 0; attempt < 3; attempt++) {
      latestSocket().serverClose(1006, '')
      await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)
    }

    expect(refreshSession).toHaveBeenCalledTimes(3)
    expect(api.socket).toBe(latestSocket())
    expect(onRevokedSocketEnded).not.toHaveBeenCalled()
  })

  it('announces the disconnect before ending a refreshed socket that is revoked again', async () => {
    const events: string[] = []
    for (const type of [
      'status',
      'reconnecting',
      'revokedSocketEnded'
    ] as const) {
      api.addEventListener(type, () => events.push(type))
    }

    await revokeOpenSocket()
    events.length = 0
    await revokeOpenSocket()

    expect(events).toEqual(['status', 'reconnecting', 'revokedSocketEnded'])
  })

  it('announces the reconnect when a reset recovers an ended revoked socket', async () => {
    const onReconnected = vi.fn()
    api.addEventListener('reconnected', onReconnected)
    await revokeOpenSocket()
    await revokeOpenSocket()
    onReconnected.mockClear()

    await api.resetSocket()
    latestSocket().simulateOpen()
    await api.resetSocket()
    latestSocket().simulateOpen()

    expect(onReconnected).toHaveBeenCalledOnce()
  })

  it('connects again with a cached credential after a reset ends the revoked state', async () => {
    await revokeOpenSocket()
    await revokeOpenSocket()

    await api.resetSocket()

    expect(FakeWebSocket.instances).toHaveLength(3)
    expect(latestSocket().url).toContain('token=token')
    expect(getAuthToken).toHaveBeenLastCalledWith({ forceRefresh: false })
  })
})
