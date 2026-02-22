import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { getServerCapability } from '@/services/serverCapabilities'

vi.mock('@/services/serverCapabilities', () => ({
  getServerCapability: vi.fn()
}))

interface MockWebSocket {
  readyState: number
  send: Mock
  close: Mock
  addEventListener: Mock
  removeEventListener: Mock
}

describe('API Feature Flags', () => {
  let mockWebSocket: MockWebSocket
  const wsEventHandlers: { [key: string]: (event: unknown) => void } = {}

  beforeEach(() => {
    vi.useFakeTimers()

    mockWebSocket = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(
        (event: string, handler: (event: unknown) => void) => {
          wsEventHandlers[event] = handler
        }
      ),
      removeEventListener: vi.fn()
    }

    vi.stubGlobal('WebSocket', function (this: WebSocket) {
      Object.assign(this, mockWebSocket)
    })

    vi.spyOn(api, 'getClientFeatureFlags').mockReturnValue({
      supports_preview_metadata: true,
      api_version: '1.0.0',
      capabilities: ['bulk_operations', 'async_nodes']
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Feature flags negotiation', () => {
    it('should send client feature flags as first message on connection', async () => {
      const initPromise = api.init()

      wsEventHandlers['open'](new Event('open'))

      expect(mockWebSocket.send).toHaveBeenCalledTimes(1)
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sentMessage).toEqual({
        type: 'feature_flags',
        data: {
          supports_preview_metadata: true,
          api_version: '1.0.0',
          capabilities: ['bulk_operations', 'async_nodes']
        }
      })

      wsEventHandlers['message']({
        data: JSON.stringify({
          type: 'status',
          data: {
            status: { exec_info: { queue_remaining: 0 } },
            sid: 'test-sid'
          }
        })
      })

      await initPromise
    })
  })

  describe('Deprecated shims delegate to getServerCapability', () => {
    it('serverSupportsFeature delegates to getServerCapability', () => {
      vi.mocked(getServerCapability).mockReturnValue(true)
      expect(api.serverSupportsFeature('some_flag')).toBe(true)
      expect(getServerCapability).toHaveBeenCalledWith('some_flag')
    })

    it('getServerFeature delegates to getServerCapability', () => {
      vi.mocked(getServerCapability).mockReturnValue(42)
      expect(api.getServerFeature('max_upload_size', 0)).toBe(42)
      expect(getServerCapability).toHaveBeenCalledWith('max_upload_size', 0)
    })

    it('getServerFeatures returns empty object', () => {
      expect(api.getServerFeatures()).toEqual({})
    })
  })

  describe('Client feature flags configuration', () => {
    it('should return a copy of client feature flags', () => {
      vi.mocked(api.getClientFeatureFlags).mockRestore()

      const clientFlags1 = api.getClientFeatureFlags()
      const clientFlags2 = api.getClientFeatureFlags()

      expect(clientFlags1).not.toBe(clientFlags2)
      expect(clientFlags1).toEqual(clientFlags2)

      clientFlags1.test_flag = true
      expect(api.getClientFeatureFlags()).not.toHaveProperty('test_flag')
    })
  })
})
