import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApi } from './ComfyApi'
import type { ComfyApiPorts } from './ComfyApi'
import { anonymousApiAuthProvider } from './apiAuthProvider'
import type { AuthTokenRequest } from './apiAuthProvider'

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

describe('ComfyApi realtime socket after a revoked credential', () => {
  let api: ComfyApi
  let mintableToken: string | undefined
  const getAuthToken = vi.fn(
    async (_request?: AuthTokenRequest) => mintableToken
  )
  const onAuthRevoked = vi.fn()

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
    onAuthRevoked.mockClear()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    api = new ComfyApi(ports)
    api.setAuthProvider({ ...anonymousApiAuthProvider, getAuthToken })
    api.addEventListener('auth_revoked', onAuthRevoked)
    await api.resetSocket()
  })

  it('force-refreshes the credential exactly once for the next attempt', async () => {
    await revokeOpenSocket()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(forcedRefreshCount()).toBe(1)
    expect(getAuthToken).toHaveBeenLastCalledWith({ forceRefresh: true })
  })

  it('stops reconnecting when the refreshed attempt closes before open', async () => {
    await revokeOpenSocket()

    latestSocket().serverClose(1006, '')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(api.socket).toBeNull()
    expect(onAuthRevoked).toHaveBeenCalledOnce()
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
    expect(onAuthRevoked).not.toHaveBeenCalled()
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
      expect(onAuthRevoked).not.toHaveBeenCalled()
    }
  )

  it('opens no tokenless socket when the refreshed credential cannot be minted', async () => {
    latestSocket().simulateOpen()
    mintableToken = undefined
    latestSocket().serverClose(1008, 'auth_revoked')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(api.socket).toBeNull()
    expect(onAuthRevoked).toHaveBeenCalledOnce()
  })

  it('connects again with a cached credential after a reset ends the revoked state', async () => {
    await revokeOpenSocket()
    latestSocket().serverClose(1006, '')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW_MS)

    await api.resetSocket()

    expect(FakeWebSocket.instances).toHaveLength(3)
    expect(latestSocket().url).toContain('token=token')
    expect(getAuthToken).toHaveBeenLastCalledWith({ forceRefresh: false })
  })
})
