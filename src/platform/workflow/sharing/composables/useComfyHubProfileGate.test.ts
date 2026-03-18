import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockResolvedUserInfo = vi.hoisted(() => ({
  value: { id: 'user-a' }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: mockFetchApi
  }
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: mockResolvedUserInfo
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    toastErrorHandler: mockToastErrorHandler
  })
}))

// Must import after vi.mock declarations
const { useComfyHubProfileGate } = await import('./useComfyHubProfileGate')

const mockProfile: ComfyHubProfile = {
  username: 'testuser',
  name: 'Test User',
  description: 'A test profile'
}

function mockSuccessResponse(data?: unknown) {
  return {
    ok: true,
    json: async () => data ?? mockProfile
  } as Response
}

function mockErrorResponse(status = 500, message = 'Server error') {
  return {
    ok: false,
    status,
    json: async () => ({ message })
  } as Response
}

describe('useComfyHubProfileGate', () => {
  let gate: ReturnType<typeof useComfyHubProfileGate>

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolvedUserInfo.value = { id: 'user-a' }

    // Reset module-level singleton refs
    gate = useComfyHubProfileGate()
    gate.hasProfile.value = null
    gate.profile.value = null
    gate.isCheckingProfile.value = false
    gate.isFetchingProfile.value = false
  })

  describe('fetchProfile', () => {
    it('returns mapped profile when API responds ok', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      const profile = await gate.fetchProfile()

      expect(profile).toEqual(mockProfile)
      expect(gate.hasProfile.value).toBe(true)
      expect(gate.profile.value).toEqual(mockProfile)
      expect(mockFetchApi).toHaveBeenCalledWith('/hub/profile')
    })

    it('returns cached profile when already fetched', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.fetchProfile()
      const profile = await gate.fetchProfile()

      expect(profile).toEqual(mockProfile)
      expect(mockFetchApi).toHaveBeenCalledTimes(1)
    })

    it('re-fetches profile when force option is enabled', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.fetchProfile()
      await gate.fetchProfile({ force: true })

      expect(mockFetchApi).toHaveBeenCalledTimes(2)
    })

    it('returns null when API responds with error', async () => {
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      const profile = await gate.fetchProfile()

      expect(profile).toBeNull()
      expect(gate.hasProfile.value).toBe(false)
      expect(gate.profile.value).toBeNull()
    })

    it('sets isFetchingProfile during fetch', async () => {
      let resolvePromise: (v: Response) => void
      mockFetchApi.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
      )

      const promise = gate.fetchProfile()
      expect(gate.isFetchingProfile.value).toBe(true)

      resolvePromise!(mockSuccessResponse())
      await promise

      expect(gate.isFetchingProfile.value).toBe(false)
    })
  })

  describe('checkProfile', () => {
    it('returns true when API responds ok', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      const result = await gate.checkProfile()

      expect(result).toBe(true)
      expect(gate.hasProfile.value).toBe(true)
    })

    it('returns false when API responds with error', async () => {
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      const result = await gate.checkProfile()

      expect(result).toBe(false)
      expect(gate.hasProfile.value).toBe(false)
    })

    it('returns cached value without re-fetching', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.checkProfile()
      const result = await gate.checkProfile()

      expect(result).toBe(true)
      expect(mockFetchApi).toHaveBeenCalledTimes(1)
    })

    it('clears cached profile state when the authenticated user changes', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.checkProfile()
      mockResolvedUserInfo.value = { id: 'user-b' }
      await gate.checkProfile()

      expect(mockFetchApi).toHaveBeenCalledTimes(2)
    })
  })

  describe('createProfile', () => {
    it('sends FormData with required username', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.createProfile({ username: 'testuser' })

      const [url, options] = mockFetchApi.mock.calls[0]
      expect(url).toBe('/hub/profile')
      expect(options.method).toBe('POST')

      const body = options.body as FormData
      expect(body.get('username')).toBe('testuser')
    })

    it('includes optional fields when provided', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())
      const coverImage = new File(['img'], 'cover.png')
      const profilePicture = new File(['img'], 'avatar.png')

      await gate.createProfile({
        username: 'testuser',
        name: 'Test User',
        description: 'Hello',
        coverImage,
        profilePicture
      })

      const body = mockFetchApi.mock.calls[0][1].body as FormData
      expect(body.get('name')).toBe('Test User')
      expect(body.get('description')).toBe('Hello')
      expect(body.get('cover_image')).toBe(coverImage)
      expect(body.get('profile_picture')).toBe(profilePicture)
    })

    it('sets profile state on success', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.createProfile({ username: 'testuser' })

      expect(gate.hasProfile.value).toBe(true)
      expect(gate.profile.value).toEqual(mockProfile)
    })

    it('returns the created profile', async () => {
      mockFetchApi.mockResolvedValue(
        mockSuccessResponse({
          username: 'testuser',
          name: 'Test User',
          description: 'A test profile',
          cover_image_url: 'https://example.com/cover.png',
          profile_picture_url: 'https://example.com/profile.png'
        })
      )

      const profile = await gate.createProfile({ username: 'testuser' })

      expect(profile).toEqual({
        ...mockProfile,
        coverImageUrl: 'https://example.com/cover.png',
        profilePictureUrl: 'https://example.com/profile.png'
      })
    })

    it('throws with error message from API response', async () => {
      mockFetchApi.mockResolvedValue(mockErrorResponse(400, 'Username taken'))

      await expect(gate.createProfile({ username: 'taken' })).rejects.toThrow(
        'Username taken'
      )
    })
  })
})
