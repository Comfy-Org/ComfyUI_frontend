import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { headerRegistry } from '@/services/headerRegistry'
import {
  createAxiosWithHeaders,
  fetchWithHeaders
} from '@/services/networkClientAdapter'
import type { IHeaderProvider } from '@/types/headerTypes'

// Mock axios
vi.mock('axios')

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('networkClientAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headerRegistry.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createAxiosWithHeaders', () => {
    it('should create an axios instance with header injection', async () => {
      // Setup mock axios instance
      const mockInterceptors = {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }

      const mockAxiosInstance = {
        interceptors: mockInterceptors,
        get: vi.fn(),
        post: vi.fn()
      }

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

      // Create instance
      createAxiosWithHeaders({ baseURL: 'https://api.example.com' })

      // Verify axios.create was called with config
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.example.com'
      })

      // Verify interceptor was added
      expect(mockInterceptors.request.use).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('should inject headers from registry on request', async () => {
      // Setup header provider
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Custom-Header': 'custom-value'
        })
      }
      headerRegistry.registerHeaderProvider(provider)

      // Setup mock axios
      const mockInterceptors = {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }

      const mockAxiosInstance = {
        interceptors: mockInterceptors
      }

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

      // Create instance
      createAxiosWithHeaders()

      // Get the interceptor function
      const [interceptorFn] = mockInterceptors.request.use.mock.calls[0]

      // Test the interceptor
      const config = {
        url: '/api/test',
        method: 'POST',
        data: { foo: 'bar' },
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const result = await interceptorFn(config)

      // Verify provider was called with correct context
      expect(provider.provideHeaders).toHaveBeenCalledWith({
        url: '/api/test',
        method: 'POST',
        body: { foo: 'bar' },
        config
      })

      // Verify headers were merged
      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value'
      })
    })

    it('should handle interceptor errors', async () => {
      // Setup mock axios
      const mockInterceptors = {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }

      const mockAxiosInstance = {
        interceptors: mockInterceptors
      }

      vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

      // Create instance
      createAxiosWithHeaders()

      // Get the error handler
      const [, errorHandler] = mockInterceptors.request.use.mock.calls[0]

      // Test error handling
      const error = new Error('Request error')
      await expect(errorHandler(error)).rejects.toThrow('Request error')
    })
  })

  describe('fetchWithHeaders', () => {
    it('should inject headers from registry into fetch requests', async () => {
      // Setup header provider
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Api-Key': 'test-key',
          'X-Request-ID': '12345'
        })
      }
      headerRegistry.registerHeaderProvider(provider)

      // Setup fetch mock
      mockFetch.mockResolvedValue(new Response('OK'))

      // Make request
      await fetchWithHeaders('https://api.example.com/data', {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      })

      // Verify provider was called
      expect(provider.provideHeaders).toHaveBeenCalledWith({
        url: 'https://api.example.com/data',
        method: 'GET',
        body: undefined
      })

      // Verify fetch was called with merged headers
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers)
        })
      )

      // Check the headers
      const [, init] = mockFetch.mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('Accept')).toBe('application/json')
      expect(headers.get('X-Api-Key')).toBe('test-key')
      expect(headers.get('X-Request-ID')).toBe('12345')
    })

    it('should handle URL objects', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({})
      }
      headerRegistry.registerHeaderProvider(provider)

      mockFetch.mockResolvedValue(new Response('OK'))

      const url = new URL('https://api.example.com/test')
      await fetchWithHeaders(url)

      expect(provider.provideHeaders).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        method: 'GET',
        body: undefined
      })
    })

    it('should handle Request objects', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Custom': 'value'
        })
      }
      headerRegistry.registerHeaderProvider(provider)

      mockFetch.mockResolvedValue(new Response('OK'))

      const request = new Request('https://api.example.com/test', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' })
      })

      await fetchWithHeaders(request)

      expect(provider.provideHeaders).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        method: 'POST',
        body: undefined // init.body is undefined when using Request object
      })

      // Verify headers were added
      const [, init] = mockFetch.mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('X-Custom')).toBe('value')
    })

    it('should convert header values to strings', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Number': 123,
          'X-Boolean': true,
          'X-String': 'test'
        })
      }
      headerRegistry.registerHeaderProvider(provider)

      mockFetch.mockResolvedValue(new Response('OK'))

      await fetchWithHeaders('https://api.example.com')

      const [, init] = mockFetch.mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('X-Number')).toBe('123')
      expect(headers.get('X-Boolean')).toBe('true')
      expect(headers.get('X-String')).toBe('test')
    })

    it('should preserve existing headers and let registry override', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Override': 'new-value',
          'X-New': 'added'
        })
      }
      headerRegistry.registerHeaderProvider(provider)

      mockFetch.mockResolvedValue(new Response('OK'))

      await fetchWithHeaders('https://api.example.com', {
        headers: {
          'X-Override': 'old-value',
          'X-Existing': 'keep-me'
        }
      })

      const [, init] = mockFetch.mock.calls[0]
      const headers = init.headers as Headers
      expect(headers.get('X-Override')).toBe('new-value') // Registry wins
      expect(headers.get('X-Existing')).toBe('keep-me')
      expect(headers.get('X-New')).toBe('added')
    })
  })
})
