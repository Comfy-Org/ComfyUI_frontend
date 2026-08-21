import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

describe('createSocket WebSocket host', () => {
  let socketUrls: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    socketUrls = []
    api.socket = null
    api.api_host = 'localhost:8188'

    vi.stubGlobal('WebSocket', function (this: WebSocket, url: string) {
      socketUrls.push(url)
      Object.assign(this, {
        readyState: 1,
        binaryType: '',
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete window.__COMFY_API_WS_HOST__
    window.name = ''
    api.socket = null
  })

  it('dials the configured host when the override is set', () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'

    api.init()

    expect(socketUrls).toHaveLength(1)
    expect(socketUrls[0]).toContain('://ws.example.com')
    expect(socketUrls[0]).not.toContain('localhost:8188')
  })

  it('preserves query parameters when the override is set', () => {
    window.__COMFY_API_WS_HOST__ = 'ws.example.com'
    window.name = 'session-123'

    api.init()

    expect(socketUrls[0]).toContain('clientId=session-123')
  })

  it('falls back to api_host when the override is unset', () => {
    api.init()

    expect(socketUrls).toHaveLength(1)
    expect(socketUrls[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is an empty string', () => {
    window.__COMFY_API_WS_HOST__ = ''

    api.init()

    expect(socketUrls[0]).toContain('://localhost:8188')
  })

  it('falls back to api_host when the override is whitespace only', () => {
    window.__COMFY_API_WS_HOST__ = '   '

    api.init()

    expect(socketUrls[0]).toContain('://localhost:8188')
  })

  it('ignores a prototype-pollution gadget and uses api_host', () => {
    // @ts-expect-error - simulating a prototype-pollution attack
    Object.prototype.__COMFY_API_WS_HOST__ = 'evil.example.com'
    try {
      api.init()

      expect(socketUrls[0]).toContain('://localhost:8188')
      expect(socketUrls[0]).not.toContain('evil.example.com')
    } finally {
      // @ts-expect-error - cleaning up the simulated attack
      delete Object.prototype.__COMFY_API_WS_HOST__
    }
  })

  it('falls back to polling without throwing when the host is unusable', () => {
    vi.stubGlobal('WebSocket', function () {
      throw new DOMException('invalid url', 'SyntaxError')
    })
    window.__COMFY_API_WS_HOST__ = 'https://not a host'

    expect(() => api.init()).not.toThrow()
    expect(api.socket).toBeNull()
  })

  it('falls back to polling when the override includes a scheme prefix', () => {
    vi.stubGlobal('WebSocket', function () {
      throw new DOMException('invalid url', 'SyntaxError')
    })
    window.__COMFY_API_WS_HOST__ = 'wss://ws.example.com'

    expect(() => api.init()).not.toThrow()
    expect(api.socket).toBeNull()
  })
})
