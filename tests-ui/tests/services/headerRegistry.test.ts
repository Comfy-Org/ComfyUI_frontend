import { beforeEach, describe, expect, it, vi } from 'vitest'

import { headerRegistry } from '@/services/headerRegistry'
import type {
  HeaderProviderContext,
  IHeaderProvider
} from '@/types/headerTypes'

describe('headerRegistry', () => {
  beforeEach(() => {
    headerRegistry.clear()
  })

  describe('registerHeaderProvider', () => {
    it('should register a header provider', () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Test': 'value' })
      }

      const registration = headerRegistry.registerHeaderProvider(provider)

      expect(registration).toBeDefined()
      expect(registration.id).toMatch(/^header-provider-\d+$/)
      expect(headerRegistry.providerCount).toBe(1)
    })

    it('should return a disposable registration', () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn()
      }

      const registration = headerRegistry.registerHeaderProvider(provider)
      expect(headerRegistry.providerCount).toBe(1)

      registration.dispose()
      expect(headerRegistry.providerCount).toBe(0)
    })

    it('should insert providers in priority order', async () => {
      const provider1: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Priority': 'low' })
      }
      const provider2: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Priority': 'high' })
      }
      const provider3: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Priority': 'medium' })
      }

      headerRegistry.registerHeaderProvider(provider1, { priority: 1 })
      headerRegistry.registerHeaderProvider(provider2, { priority: 10 })
      headerRegistry.registerHeaderProvider(provider3, { priority: 5 })

      const context: HeaderProviderContext = {
        url: 'https://api.example.com',
        method: 'GET'
      }

      const headers = await headerRegistry.getHeaders(context)

      // Higher priority provider should override
      expect(headers['X-Priority']).toBe('high')
    })
  })

  describe('getHeaders', () => {
    it('should combine headers from all providers', async () => {
      const provider1: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Header-1': 'value1',
          'X-Common': 'provider1'
        })
      }
      const provider2: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Header-2': 'value2',
          'X-Common': 'provider2'
        })
      }

      headerRegistry.registerHeaderProvider(provider1, { priority: 1 })
      headerRegistry.registerHeaderProvider(provider2, { priority: 2 })

      const context: HeaderProviderContext = {
        url: 'https://api.example.com',
        method: 'GET'
      }

      const headers = await headerRegistry.getHeaders(context)

      expect(headers).toEqual({
        'X-Header-1': 'value1',
        'X-Header-2': 'value2',
        'X-Common': 'provider2' // Higher priority wins
      })
    })

    it('should resolve function header values', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({
          'X-Static': 'static',
          'X-Dynamic': () => 'dynamic',
          'X-Async': async () => 'async-value'
        })
      }

      headerRegistry.registerHeaderProvider(provider)

      const context: HeaderProviderContext = {
        url: 'https://api.example.com',
        method: 'GET'
      }

      const headers = await headerRegistry.getHeaders(context)

      expect(headers).toEqual({
        'X-Static': 'static',
        'X-Dynamic': 'dynamic',
        'X-Async': 'async-value'
      })
    })

    it('should handle async providers', async () => {
      const provider: IHeaderProvider = {
        provideHeaders: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return { 'X-Async': 'resolved' }
        })
      }

      headerRegistry.registerHeaderProvider(provider)

      const context: HeaderProviderContext = {
        url: 'https://api.example.com',
        method: 'GET'
      }

      const headers = await headerRegistry.getHeaders(context)

      expect(headers).toEqual({ 'X-Async': 'resolved' })
    })

    it('should apply filters when provided', async () => {
      const provider1: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Api': 'api-header' })
      }
      const provider2: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Other': 'other-header' })
      }

      // Only apply to API URLs
      headerRegistry.registerHeaderProvider(provider1, {
        filter: (ctx) => ctx.url.includes('/api/')
      })

      // Apply to all URLs
      headerRegistry.registerHeaderProvider(provider2)

      const apiContext: HeaderProviderContext = {
        url: 'https://example.com/api/users',
        method: 'GET'
      }

      const otherContext: HeaderProviderContext = {
        url: 'https://example.com/assets/image.png',
        method: 'GET'
      }

      const apiHeaders = await headerRegistry.getHeaders(apiContext)
      const otherHeaders = await headerRegistry.getHeaders(otherContext)

      expect(apiHeaders).toEqual({
        'X-Api': 'api-header',
        'X-Other': 'other-header'
      })

      expect(otherHeaders).toEqual({
        'X-Other': 'other-header'
      })
    })

    it('should continue with other providers if one fails', async () => {
      const provider1: IHeaderProvider = {
        provideHeaders: vi.fn().mockRejectedValue(new Error('Provider error'))
      }
      const provider2: IHeaderProvider = {
        provideHeaders: vi.fn().mockReturnValue({ 'X-Header': 'value' })
      }

      headerRegistry.registerHeaderProvider(provider1)
      headerRegistry.registerHeaderProvider(provider2)

      const context: HeaderProviderContext = {
        url: 'https://api.example.com',
        method: 'GET'
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const headers = await headerRegistry.getHeaders(context)

      expect(headers).toEqual({ 'X-Header': 'value' })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting headers from provider'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('clear', () => {
    it('should remove all providers', () => {
      const provider1: IHeaderProvider = {
        provideHeaders: vi.fn()
      }
      const provider2: IHeaderProvider = {
        provideHeaders: vi.fn()
      }

      headerRegistry.registerHeaderProvider(provider1)
      headerRegistry.registerHeaderProvider(provider2)

      expect(headerRegistry.providerCount).toBe(2)

      headerRegistry.clear()

      expect(headerRegistry.providerCount).toBe(0)
    })
  })

  describe('providerCount', () => {
    it('should return the correct count of providers', () => {
      expect(headerRegistry.providerCount).toBe(0)

      const provider: IHeaderProvider = {
        provideHeaders: vi.fn()
      }

      const reg1 = headerRegistry.registerHeaderProvider(provider)
      expect(headerRegistry.providerCount).toBe(1)

      const reg2 = headerRegistry.registerHeaderProvider(provider)
      expect(headerRegistry.providerCount).toBe(2)

      reg1.dispose()
      expect(headerRegistry.providerCount).toBe(1)

      reg2.dispose()
      expect(headerRegistry.providerCount).toBe(0)
    })
  })
})
