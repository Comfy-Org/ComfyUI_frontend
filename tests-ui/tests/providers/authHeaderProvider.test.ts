import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ApiKeyHeaderProvider,
  AuthHeaderProvider,
  FirebaseAuthHeaderProvider
} from '@/providers/authHeaderProvider'
import type { HeaderProviderContext } from '@/types/headerTypes'

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

describe('authHeaderProvider', () => {
  const mockContext: HeaderProviderContext = {
    url: 'https://api.example.com/test',
    method: 'GET'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AuthHeaderProvider', () => {
    it('should provide Firebase auth header when available', async () => {
      const provider = new AuthHeaderProvider()
      const mockAuthHeader = { Authorization: 'Bearer firebase-token-123' }

      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockAuthHeader)

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual(mockAuthHeader)
      expect(mockFirebaseAuthStore.getAuthHeader).toHaveBeenCalledOnce()
    })

    it('should provide API key header when Firebase auth is not available', async () => {
      const provider = new AuthHeaderProvider()
      const mockApiKeyHeader = { 'X-API-KEY': 'test-api-key' }

      // Firebase returns null, but includes API key as fallback
      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(mockApiKeyHeader)

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual(mockApiKeyHeader)
    })

    it('should return empty object when no auth is available', async () => {
      const provider = new AuthHeaderProvider()

      mockFirebaseAuthStore.getAuthHeader.mockResolvedValue(null)

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual({})
    })
  })

  describe('ApiKeyHeaderProvider', () => {
    it('should provide API key header when available', () => {
      const provider = new ApiKeyHeaderProvider()
      const mockApiKeyHeader = { 'X-API-KEY': 'test-api-key' }

      mockApiKeyAuthStore.getAuthHeader.mockReturnValue(mockApiKeyHeader)

      const headers = provider.provideHeaders(mockContext)

      expect(headers).toEqual(mockApiKeyHeader)
      expect(mockApiKeyAuthStore.getAuthHeader).toHaveBeenCalledOnce()
    })

    it('should return empty object when no API key is available', () => {
      const provider = new ApiKeyHeaderProvider()

      mockApiKeyAuthStore.getAuthHeader.mockReturnValue(null)

      const headers = provider.provideHeaders(mockContext)

      expect(headers).toEqual({})
    })
  })

  describe('FirebaseAuthHeaderProvider', () => {
    it('should provide Firebase auth header when available', async () => {
      const provider = new FirebaseAuthHeaderProvider()
      const mockToken = 'firebase-token-456'

      mockFirebaseAuthStore.getIdToken.mockResolvedValue(mockToken)

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual({
        Authorization: `Bearer ${mockToken}`
      })
      expect(mockFirebaseAuthStore.getIdToken).toHaveBeenCalledOnce()
    })

    it('should return empty object when no Firebase token is available', async () => {
      const provider = new FirebaseAuthHeaderProvider()

      mockFirebaseAuthStore.getIdToken.mockResolvedValue(null)

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual({})
    })

    it('should not fall back to API key', async () => {
      const provider = new FirebaseAuthHeaderProvider()

      // Firebase has no token
      mockFirebaseAuthStore.getIdToken.mockResolvedValue(null)
      // API key is available
      mockApiKeyAuthStore.getAuthHeader.mockReturnValue({
        'X-API-KEY': 'test-key'
      })

      const headers = await provider.provideHeaders(mockContext)

      expect(headers).toEqual({})
      // Should not call API key store
      expect(mockApiKeyAuthStore.getAuthHeader).not.toHaveBeenCalled()
    })
  })
})
