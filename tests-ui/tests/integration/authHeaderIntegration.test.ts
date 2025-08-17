import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthHeaderProvider } from '@/providers/authHeaderProvider'
import { headerRegistry } from '@/services/headerRegistry'
import {
  createAxiosWithHeaders,
  fetchWithHeaders
} from '@/services/networkClientAdapter'

// Mock stores
const mockFirebaseAuthStore = {
  getAuthHeader: vi.fn(),
  getIdToken: vi.fn()
}

const mockApiKeyAuthStore = {
  getAuthHeader: vi.fn()
}

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: () => mockFirebaseAuthStore
}))

vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => mockApiKeyAuthStore
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock axios
vi.mock('axios')
const mockedAxios = axios as any

describe('Auth Header Integration', () => {
  let authProviderRegistration: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    })

    // Reset axios mock
    mockedAxios.create.mockReturnValue({
      interceptors: {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      },
      defaults: {
        headers: {
          common: {},
          get: {},
          post: {},
          put: {},
          patch: {},
          delete: {}
        }
      }
    })

    // Register auth header provider
    authProviderRegistration = headerRegistry.registerHeaderProvider(
      new AuthHeaderProvider(),
      { priority: 1000 }
    )
  })

  afterEach(() => {
    // Unregister the provider
    authProviderRegistration.unregister()
    vi.restoreAllMocks()
  })

  describe('fetchWithHeaders integration', () => {
    it('should automatically add Firebase auth headers to fetch requests', async () => {
      const mockAuthHeader = { Authorization: 'Bearer firebase-token-123' }
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockAuthHeader)

      await fetchWithHeaders('https://api.example.com/data')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      )

      // Verify the auth header was added
      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer firebase-token-123')
    })

    it('should automatically add API key headers when Firebase is not available', async () => {
      const mockApiKeyHeader = { 'X-API-KEY': 'test-api-key' }
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockApiKeyHeader)

      await fetchWithHeaders('https://api.example.com/data')

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Headers
      expect(headers.get('X-API-KEY')).toBe('test-api-key')
    })

    it('should merge auth headers with existing headers', async () => {
      const mockAuthHeader = { Authorization: 'Bearer firebase-token-123' }
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockAuthHeader)

      await fetchWithHeaders('https://api.example.com/data', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      })

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Headers
      expect(headers.get('Authorization')).toBe('Bearer firebase-token-123')
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('X-Custom-Header')).toBe('custom-value')
    })

    it('should not add headers when no auth is available', async () => {
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(null)

      await fetchWithHeaders('https://api.example.com/data')

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Headers
      expect(headers.get('Authorization')).toBeNull()
      expect(headers.get('X-API-KEY')).toBeNull()
    })
  })

  describe('createAxiosWithHeaders integration', () => {
    it('should setup interceptor to add auth headers', async () => {
      const mockInstance = {
        interceptors: {
          request: {
            use: vi.fn()
          },
          response: {
            use: vi.fn()
          }
        },
        defaults: {
          headers: {
            common: {},
            get: {},
            post: {},
            put: {},
            patch: {},
            delete: {}
          }
        }
      }

      mockedAxios.create.mockReturnValue(mockInstance)

      createAxiosWithHeaders({ baseURL: 'https://api.example.com' })

      // Verify interceptor was registered
      expect(mockInstance.interceptors.request.use).toHaveBeenCalledOnce()

      // Get the interceptor function
      const interceptorCall =
        mockInstance.interceptors.request.use.mock.calls[0]
      const requestInterceptor = interceptorCall[0]

      // Test the interceptor
      const mockAuthHeader = { Authorization: 'Bearer firebase-token-123' }
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockAuthHeader)

      const config = {
        url: '/test',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const modifiedConfig = await requestInterceptor(config)

      expect(modifiedConfig.headers.Authorization).toBe(
        'Bearer firebase-token-123'
      )
      expect(modifiedConfig.headers['Content-Type']).toBe('application/json')
    })
  })

  describe('Multiple providers with priority', () => {
    it('should apply headers in priority order', async () => {
      // Register a second provider with higher priority
      const customProvider = {
        provideHeaders: vi.fn().mockResolvedValue({
          'X-Custom': 'high-priority',
          Authorization: 'Bearer custom-token' // This should override the auth provider
        })
      }

      const customRegistration = headerRegistry.registerHeaderProvider(
        customProvider,
        { priority: 2000 } // Higher priority than auth provider
      )

      // Auth provider returns different token
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue({
        Authorization: 'Bearer firebase-token'
      })

      await fetchWithHeaders('https://api.example.com/data')

      const callArgs = mockFetch.mock.calls[0]
      const headers = callArgs[1].headers as Headers

      // Higher priority provider should win
      expect(headers.get('Authorization')).toBe('Bearer custom-token')
      expect(headers.get('X-Custom')).toBe('high-priority')

      customRegistration.dispose()
    })
  })
})
