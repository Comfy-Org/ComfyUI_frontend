import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

let currentToken: string | undefined = 'token-a'
// When set, each getAuthToken() call parks until released, capturing the token
// value that was active at call time — models a deferred/async token fetch.
let deferTokenFetch = false
let pendingTokenReleases: (() => void)[] = []

const releaseNextToken = async () => {
  const release = pendingTokenReleases.shift()
  release?.()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

vi.mock('@/platform/distribution/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/platform/distribution/types')>()),
  isCloud: true
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    getAuthToken: () => {
      if (!deferTokenFetch) return Promise.resolve(currentToken)
      const captured = currentToken
      return new Promise<string | undefined>((resolve) => {
        pendingTokenReleases.push(() => resolve(captured))
      })
    }
  })
}))

class FakeWebSocket {
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readyState = FakeWebSocket.OPEN
  binaryType = ''
  send = vi.fn()
  removeEventListener = vi.fn()
  handlers: Record<string, (event: unknown) => void> = {}
  addEventListener = vi.fn(
    (event: string, handler: (event: unknown) => void) => {
      this.handlers[event] = handler
    }
  )
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED
    this.handlers['close']?.(new Event('close'))
  })

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.handlers['open']?.(new Event('open'))
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('ComfyApi realtime socket reset', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    currentToken = 'token-a'
    deferTokenFetch = false
    pendingTokenReleases = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    api.socket = null
  })

  afterEach(() => {
    api.socket = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('closes the previous socket and opens a fresh one on reset', async () => {
    await api.resetSocket()
    expect(FakeWebSocket.instances).toHaveLength(1)
    const first = FakeWebSocket.instances[0]
    first.simulateOpen()

    await api.resetSocket()

    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(first.close).toHaveBeenCalled()
    expect(api.socket).toBe(FakeWebSocket.instances[1])
  })

  it('re-authenticates the new socket with the active account token', async () => {
    await api.resetSocket()
    expect(FakeWebSocket.instances[0].url).toContain('token=token-a')

    currentToken = 'token-b'
    await api.resetSocket()

    expect(FakeWebSocket.instances[1].url).toContain('token=token-b')
    expect(FakeWebSocket.instances[1].url).not.toContain('token=token-a')
  })

  it('does not let the replaced socket spawn a competing reconnect', async () => {
    await api.resetSocket()
    const stale = FakeWebSocket.instances[0]
    stale.simulateOpen()

    await api.resetSocket()
    expect(FakeWebSocket.instances).toHaveLength(2)

    // A late close event on the socket that was already replaced must be a
    // no-op; only the active socket owns the reconnect lifecycle.
    stale.handlers['close']?.(new Event('close'))
    await flush()

    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('supersedes an in-flight reset so the socket cannot settle on a stale identity', async () => {
    await api.resetSocket()
    expect(FakeWebSocket.instances).toHaveLength(1)

    deferTokenFetch = true

    // A -> B begins and parks on its token fetch (captured as token-b).
    currentToken = 'token-b'
    const firstSwitch = api.resetSocket()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // B -> C arrives before B's token resolves, bumping the connect generation.
    currentToken = 'token-c'
    const secondSwitch = api.resetSocket()

    // B's fetch resolves, but its generation was superseded, so it bails
    // without opening a socket.
    await releaseNextToken()
    // C's fetch resolves and, as the latest generation, opens the socket.
    await releaseNextToken()
    await Promise.all([firstSwitch, secondSwitch])

    const last = FakeWebSocket.instances.at(-1)!
    expect(api.socket).toBe(last)
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(last.url).toContain('token=token-c')
    expect(last.url).not.toContain('token=token-b')
  })

  it('clears the stale client id and handshake identity when resetting', async () => {
    window.name = 'client-from-account-a'
    sessionStorage.setItem('clientId', 'client-from-account-a')
    await api.resetSocket()
    api.clientId = 'client-from-account-a'

    await api.resetSocket()

    expect(api.clientId).toBeUndefined()
    expect(window.name).toBe('')
    expect(sessionStorage.getItem('clientId')).toBeNull()
  })
})
