import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionCookie } from './useSessionCookie'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock api.apiURL
vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `https://test-api.com${path}`)
  }
}))

// Mock isCloud to always return true for testing
vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

// Mock useFirebaseAuthStore
const mockGetAuthHeader = vi.fn()
vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    getAuthHeader: mockGetAuthHeader
  }))
}))

describe('useSessionCookie', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFetch.mockReset()
    mockGetAuthHeader.mockReset()
  })

  describe('createSession', () => {
    it('should succeed on first attempt', async () => {
      // Mock successful auth header and API response
      mockGetAuthHeader.mockResolvedValue({ Authorization: 'Bearer token' })
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      })

      const { createSession } = useSessionCookie()
      await createSession()

      expect(mockGetAuthHeader).toHaveBeenCalledWith(false) // First attempt with cached token
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/auth/session',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json'
          }
        }
      )
    })

    it('should retry with fresh token after 401 error and succeed', async () => {
      // First attempt: auth header success but API returns 401
      // Second attempt: fresh token and API success
      mockGetAuthHeader
        .mockResolvedValueOnce({ Authorization: 'Bearer cached-token' })
        .mockResolvedValueOnce({ Authorization: 'Bearer fresh-token' })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Token expired' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })

      const { createSession } = useSessionCookie()
      await createSession()

      expect(mockGetAuthHeader).toHaveBeenCalledTimes(2)
      expect(mockGetAuthHeader).toHaveBeenNthCalledWith(1, false) // First attempt with cached token
      expect(mockGetAuthHeader).toHaveBeenNthCalledWith(2, true) // Second attempt with forced refresh

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://test-api.com/auth/session',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer cached-token',
            'Content-Type': 'application/json'
          }
        }
      )
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://test-api.com/auth/session',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer fresh-token',
            'Content-Type': 'application/json'
          }
        }
      )
    })

    it('should fail after all retries with API error', async () => {
      // All attempts return auth headers but API always fails
      mockGetAuthHeader.mockResolvedValue({ Authorization: 'Bearer token' })
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error' })
      })

      const { createSession } = useSessionCookie()

      await expect(createSession()).rejects.toThrow(
        'Failed to create session: Server error'
      )

      expect(mockGetAuthHeader).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should succeed after auth header null then fresh token success', async () => {
      // First attempt: no auth header (token timing issue)
      // Second attempt: fresh token success
      mockGetAuthHeader
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ Authorization: 'Bearer fresh-token' })

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      })

      const { createSession } = useSessionCookie()
      await createSession()

      expect(mockGetAuthHeader).toHaveBeenCalledTimes(2)
      expect(mockGetAuthHeader).toHaveBeenNthCalledWith(1, false) // First attempt with cached token
      expect(mockGetAuthHeader).toHaveBeenNthCalledWith(2, true) // Second attempt with forced refresh

      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called when auth header is available
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/auth/session',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer fresh-token',
            'Content-Type': 'application/json'
          }
        }
      )
    })

    it('should fail when no auth header is available after all retries', async () => {
      // All attempts fail to get auth header (complete auth failure)
      mockGetAuthHeader.mockResolvedValue(null)

      const { createSession } = useSessionCookie()

      await expect(createSession()).rejects.toThrow(
        'No auth header available for session creation after retries'
      )

      expect(mockGetAuthHeader).toHaveBeenCalledTimes(3)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle mixed auth header failures and successes', async () => {
      // First attempt: no auth header
      // Second attempt: auth header but API fails
      // Third attempt: auth header and API success
      mockGetAuthHeader
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ Authorization: 'Bearer token' })
        .mockResolvedValueOnce({ Authorization: 'Bearer fresh-token' })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: () => Promise.resolve({ message: 'Token expired' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200
        })

      const { createSession } = useSessionCookie()
      await createSession()

      expect(mockGetAuthHeader).toHaveBeenCalledTimes(3)
      expect(mockFetch).toHaveBeenCalledTimes(2) // Only called when auth header is available
    })

    it('should handle JSON parsing errors gracefully', async () => {
      mockGetAuthHeader.mockResolvedValue({ Authorization: 'Bearer token' })
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const { createSession } = useSessionCookie()

      await expect(createSession()).rejects.toThrow(
        'Failed to create session: Internal Server Error'
      )
    })
  })

  describe('deleteSession', () => {
    it('should successfully delete session', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      })

      const { deleteSession } = useSessionCookie()
      await deleteSession()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/auth/session',
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
    })

    it('should handle delete session errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Session not found' })
      })

      const { deleteSession } = useSessionCookie()

      await expect(deleteSession()).rejects.toThrow(
        'Failed to delete session: Session not found'
      )
    })

    it('should handle delete session JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const { deleteSession } = useSessionCookie()

      await expect(deleteSession()).rejects.toThrow(
        'Failed to delete session: Internal Server Error'
      )
    })
  })
})
