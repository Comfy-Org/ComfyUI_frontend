import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

interface StubSocket {
  url: string
  listeners: Map<string, Set<() => void>>
}

describe('createSocket WebSocket host', () => {
  let sockets: StubSocket[]
  let rejectedUrls: string[]
  let fetchApi: MockInstance<typeof api.fetchApi>

  const socketUrls = () => sockets.map((socket) => socket.url)

  const promptRequests = () =>
    fetchApi.mock.calls.filter(([route]) => route === '/prompt').length

  const dispatchToSocket = (index: number, type: string) => {
    const socket = sockets.at(index)
    if (!socket) throw new Error(`no socket to dispatch "${type}" to`)
    for (const listener of socket.listeners.get(type) ?? []) listener()
  }

  const dispatchToLatestSocket = (type: string) => dispatchToSocket(-1, type)

  const stubConnectingWebSocket = () => {
    vi.stubGlobal('WebSocket', function (this: WebSocket, url: string) {
      if (!URL.canParse(url)) {
        rejectedUrls.push(url)
        throw new DOMException(`The URL '${url}' is invalid.`, 'SyntaxError')
      }
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

  beforeEach(() => {
    sockets = []
    rejectedUrls = []
    vi.mocked(reportError).mockClear()
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

  it('dials the configured host when the override is set', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'

    await api.init()

    expect(socketUrls()).toHaveLength(1)
    expect(socketUrls()[0]).toContain('://ws.example.com')
    expect(socketUrls()[0]).not.toContain('localhost:8188')
  })

  it('preserves query parameters when the override is set', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'
    window.name = 'session-123'

    await api.init()

    expect(socketUrls()[0]).toContain('clientId=session-123')
  })

  it('falls back to api_host when the override is unset', async () => {
    await api.init()

    expect(socketUrls()).toHaveLength(1)
    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is an empty string', async () => {
    window.__COMFY_API_WS_HOST__ = ''

    await api.init()

    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is whitespace only', async () => {
    window.__COMFY_API_WS_HOST__ = '   '

    await api.init()

    expect(socketUrls()[0]).toContain('://localhost:8188')
  })

  it('ignores a prototype-pollution gadget and uses api_host', async () => {
    Object.defineProperty(Object.prototype, '__COMFY_API_WS_HOST__', {
      value: 'evil.example.com',
      configurable: true,
      writable: true
    })
    try {
      await api.init()

      expect(socketUrls()[0]).toContain('://localhost:8188')
      expect(socketUrls()[0]).not.toContain('evil.example.com')
    } finally {
      Reflect.deleteProperty(Object.prototype, '__COMFY_API_WS_HOST__')
    }
  })

  it('falls back to polling without throwing when the host is unusable', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'

    await expect(api.init()).resolves.toBeUndefined()
    expect(api.socket).toBeNull()
    expect(rejectedUrls).toEqual([
      expect.stringContaining('://ws.example.com:notaport/')
    ])

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it.for([
    'wss://ws.example.com',
    'ws.example.com/path',
    'user@ws.example.com',
    'ws.example.com?x=1',
    'ws.example.com#frag'
  ])(
    'falls back to polling instead of dialing a non-bare override %s',
    async (override) => {
      window.__COMFY_API_WS_HOST__ = override

      await expect(api.init()).resolves.toBeUndefined()
      expect(socketUrls()).toEqual([])
      expect(api.socket).toBeNull()
      expect(reportError).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(1000)
      expect(promptRequests()).toBe(1)
    }
  )

  it('reports a construction failure without the socket URL query', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'
    window.name = 'session-123'

    await api.init()

    expect(rejectedUrls[0]).toContain('clientId=session-123')
    expect(reportError).toHaveBeenCalledOnce()
    const [reported] = vi.mocked(reportError).mock.calls[0]
    expect(String(reported)).toContain('ws.example.com:notaport')
    expect(String(reported)).not.toContain('session-123')
  })

  it('falls back to polling when a constructed socket errors before opening', async () => {
    await api.init()

    dispatchToLatestSocket('error')

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('reuses one polling loop across repeated connection failures', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'

    await api.init()
    await api.resetSocket()

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)
  })

  it('stops polling once a socket opens', async () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'
    await api.init()
    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)

    delete window.__COMFY_API_WS_HOST__
    await api.resetSocket()
    dispatchToLatestSocket('open')

    await vi.advanceTimersByTimeAsync(5000)
    expect(promptRequests()).toBe(1)
  })

  it('keeps polling when a replaced socket opens late', async () => {
    await api.init()
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'
    await api.resetSocket()
    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(1)

    dispatchToSocket(0, 'open')

    await vi.advanceTimersByTimeAsync(1000)
    expect(promptRequests()).toBe(2)
  })

  it('reports a failed poll response as a disconnect', async () => {
    const statusEvents: unknown[] = []
    const onStatus = (event: CustomEvent) => statusEvents.push(event.detail)
    api.addEventListener('status', onStatus)
    fetchApi.mockImplementation(
      async () => new Response('{"error":"bad gateway"}', { status: 502 })
    )
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'
    try {
      await api.init()
      await vi.advanceTimersByTimeAsync(1000)

      expect(statusEvents).toEqual([null])
    } finally {
      api.removeEventListener('status', onStatus)
    }
  })

  it('drops a poll response that resolves after the socket opens', async () => {
    const statusEvents: unknown[] = []
    const onStatus = (event: CustomEvent) => statusEvents.push(event.detail)
    api.addEventListener('status', onStatus)
    let resolvePoll: (response: Response) => void = () => {}
    const pendingPoll = new Promise<Response>((resolve) => {
      resolvePoll = resolve
    })
    fetchApi.mockImplementation(() => pendingPoll)
    window.__COMFY_API_WS_HOST__ = 'ws.example.com:notaport'
    try {
      await api.init()
      await vi.advanceTimersByTimeAsync(1000)
      expect(promptRequests()).toBe(1)

      delete window.__COMFY_API_WS_HOST__
      await api.resetSocket()
      dispatchToLatestSocket('open')
      resolvePoll(new Response('{"exec_info":{"queue_remaining":3}}'))
      await vi.advanceTimersByTimeAsync(0)

      expect(statusEvents).toEqual([])
    } finally {
      api.removeEventListener('status', onStatus)
    }
  })
})
