import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

interface StubSocket {
  url: string
  listeners: Map<string, Set<() => void>>
}

describe('createSocket WebSocket host', () => {
  let sockets: StubSocket[]
  let fetchApi: MockInstance<typeof api.fetchApi>

  const socketUrls = () => sockets.map((socket) => socket.url)

  const promptRequests = () =>
    fetchApi.mock.calls.filter(([route]) => route === '/prompt').length

  const dispatchToLatestSocket = (type: string) => {
    const socket = sockets.at(-1)
    if (!socket) throw new Error(`no socket to dispatch "${type}" to`)
    for (const listener of socket.listeners.get(type) ?? []) listener()
  }

  const stubConnectingWebSocket = () => {
    vi.stubGlobal('WebSocket', function (this: WebSocket, url: string) {
      const listeners = new Map<string, Set<() => void>>()
      sockets.push({ url, listeners })
      Object.assign(this, {
        readyState: 1,
        binaryType: '',
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: (type: string, listener: () => void) => {
          const forType = listeners.get(type) ?? new Set<() => void>()
          forType.add(listener)
          listeners.set(type, forType)
        },
        removeEventListener: vi.fn()
      })
    })
  }

  const stubUnusableWebSocket = () => {
    vi.stubGlobal('WebSocket', function () {
      throw new DOMException('invalid url', 'SyntaxError')
    })
  }

  beforeEach(() => {
    sockets = []
    api.socket = null
    api.api_host = 'localhost:8188'
    fetchApi = vi
      .spyOn(api, 'fetchApi')
      .mockImplementation(
        async () => new Response('{"exec_info":{"queue_remaining":0}}')
      )

    stubConnectingWebSocket()
  })

  afterEach(() => {
    Reflect.set(api, 'pollQueueInterval', null)
    delete window.__COMFY_API_WS_HOST__
    window.name = ''
    api.socket = null
  })

  it('dials the configured host when the override is set', () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'

    api.init()

    expect(socketUrls()).toHaveLength(1)
    expect(socketUrls()[0]).toContain('://ws.example.com')
    expect(socketUrls()[0]).not.toContain('localhost:8188')
  })

  it('preserves query parameters when the override is set', () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'
    window.name = 'session-123'

    api.init()

    expect(socketUrls()[0]).toContain('clientId=session-123')
  })

  it('falls back to api_host when the override is unset', () => {
    api.init()

    expect(socketUrls()).toHaveLength(1)
    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is an empty string', () => {
    window.__COMFY_API_WS_HOST__ = ''

    api.init()

    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is whitespace only', () => {
    window.__COMFY_API_WS_HOST__ = '   '

    api.init()

    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('ignores a prototype-pollution gadget and uses api_host', () => {
    Object.defineProperty(Object.prototype, '__COMFY_API_WS_HOST__', {
      value: 'evil.example.com',
      configurable: true,
      writable: true
    })
    try {
      api.init()

      expect(socketUrls()[0]).toContain('://localhost:8188')
      expect(socketUrls()[0]).not.toContain('evil.example.com')
    } finally {
      Reflect.deleteProperty(Object.prototype, '__COMFY_API_WS_HOST__')
    }
  })

  it('falls back to polling without throwing when the host is unusable', async () => {
    stubUnusableWebSocket()
    window.__COMFY_API_WS_HOST__ = 'https://not a host'

    expect(() => api.init()).not.toThrow()
    expect(api.socket).toBeNull()

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('falls back to polling when the override includes a scheme prefix', async () => {
    stubUnusableWebSocket()
    window.__COMFY_API_WS_HOST__ = 'wss://ws.example.com'

    expect(() => api.init()).not.toThrow()
    expect(api.socket).toBeNull()

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('falls back to polling when a constructed socket errors before opening', async () => {
    api.init()

    dispatchToLatestSocket('error')

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('reuses one polling loop across repeated connection failures', async () => {
    stubUnusableWebSocket()
    window.__COMFY_API_WS_HOST__ = 'https://not a host'

    api.init()
    await api.resetSocket()

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('stops polling once a socket opens', async () => {
    stubUnusableWebSocket()
    window.__COMFY_API_WS_HOST__ = 'https://not a host'
    api.init()
    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)

    delete window.__COMFY_API_WS_HOST__
    stubConnectingWebSocket()
    await api.resetSocket()
    dispatchToLatestSocket('open')

    await vi.advanceTimersByTimeAsync(5000)
    expect(promptRequests()).toBe(1)
  })
})
