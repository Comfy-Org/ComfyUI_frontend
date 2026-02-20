import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

const mockFetchApi = vi.hoisted(() => vi.fn())
const mockPublishShow = vi.hoisted(() => vi.fn())
const mockShareHide = vi.hoisted(() => vi.fn())
const mockShowDialog = vi.hoisted(() => vi.fn())
const mockCloseDialog = vi.hoisted(() => vi.fn())
const mockFlags = vi.hoisted(() => ({
  comfyHubProfileGateEnabled: false
}))

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: mockFetchApi
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags })
}))

vi.mock('./useComfyHubPublishDialog', () => ({
  useComfyHubPublishDialog: () => ({ show: mockPublishShow })
}))

vi.mock('./useShareDialog', () => ({
  useShareDialog: () => ({ hide: mockShareHide })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: mockShowDialog,
    closeDialog: mockCloseDialog
  })
}))

vi.mock(
  '@/platform/workflow/sharing/components/comfyhub/profile/ComfyHubProfileGateDialog.vue',
  () => ({ default: {} })
)

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
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    mockFlags.comfyHubProfileGateEnabled = false

    // Reset module-level singleton refs
    gate = useComfyHubProfileGate()
    gate.hasProfile.value = null
    gate.isCheckingProfile.value = false
  })

  describe('checkProfile', () => {
    it('returns true when API responds ok', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      const result = await gate.checkProfile()

      expect(result).toBe(true)
      expect(gate.hasProfile.value).toBe(true)
      expect(mockFetchApi).toHaveBeenCalledWith('/hub/profile')
    })

    it('returns false when API responds with error', async () => {
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      const result = await gate.checkProfile()

      expect(result).toBe(false)
      expect(gate.hasProfile.value).toBe(false)
    })

    it('returns false when API throws', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'))

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

    it('sets isCheckingProfile during fetch', async () => {
      let resolvePromise: (v: Response) => void
      mockFetchApi.mockReturnValue(
        new Promise<Response>((resolve) => {
          resolvePromise = resolve
        })
      )

      const promise = gate.checkProfile()
      expect(gate.isCheckingProfile.value).toBe(true)

      resolvePromise!(mockSuccessResponse())
      await promise

      expect(gate.isCheckingProfile.value).toBe(false)
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
      expect(body.get('coverImage')).toBe(coverImage)
      expect(body.get('profilePicture')).toBe(profilePicture)
    })

    it('omits optional fields when not provided', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.createProfile({ username: 'testuser' })

      const body = mockFetchApi.mock.calls[0][1].body as FormData
      expect(body.has('name')).toBe(false)
      expect(body.has('description')).toBe(false)
      expect(body.has('coverImage')).toBe(false)
      expect(body.has('profilePicture')).toBe(false)
    })

    it('sets hasProfile to true on success', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.createProfile({ username: 'testuser' })

      expect(gate.hasProfile.value).toBe(true)
    })

    it('returns the created profile', async () => {
      mockFetchApi.mockResolvedValue(mockSuccessResponse(mockProfile))

      const profile = await gate.createProfile({ username: 'testuser' })

      expect(profile).toEqual(mockProfile)
    })

    it('throws with error message from API response', async () => {
      mockFetchApi.mockResolvedValue(mockErrorResponse(400, 'Username taken'))

      await expect(gate.createProfile({ username: 'taken' })).rejects.toThrow(
        'Username taken'
      )
    })

    it('throws with fallback message when response has no message', async () => {
      mockFetchApi.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json')
        }
      } as unknown as Response)

      await expect(
        gate.createProfile({ username: 'testuser' })
      ).rejects.toThrow('Failed to create profile')
    })
  })

  describe('openPublishWithGate', () => {
    it('shows publish dialog directly when flag is off', async () => {
      mockFlags.comfyHubProfileGateEnabled = false

      await gate.openPublishWithGate()

      expect(mockPublishShow).toHaveBeenCalledOnce()
      expect(mockFetchApi).not.toHaveBeenCalled()
      expect(mockShareHide).not.toHaveBeenCalled()
    })

    it('shows publish dialog when flag is on and profile exists', async () => {
      mockFlags.comfyHubProfileGateEnabled = true
      mockFetchApi.mockResolvedValue(mockSuccessResponse())

      await gate.openPublishWithGate()

      expect(mockPublishShow).toHaveBeenCalledOnce()
      expect(mockShowDialog).not.toHaveBeenCalled()
      expect(mockShareHide).not.toHaveBeenCalled()
    })

    it('closes share dialog and shows gate dialog when no profile', async () => {
      mockFlags.comfyHubProfileGateEnabled = true
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      mockShowDialog.mockImplementation(({ props }) => {
        expect(mockShareHide).toHaveBeenCalledOnce()
        props.onClose()
      })

      await gate.openPublishWithGate()

      expect(mockShowDialog).toHaveBeenCalledOnce()
      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'comfyhub-profile-gate'
        })
      )
      expect(mockPublishShow).not.toHaveBeenCalled()
    })

    it('opens publish dialog when gate completes', async () => {
      mockFlags.comfyHubProfileGateEnabled = true
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      mockShowDialog.mockImplementation(({ props }) => {
        props.onComplete()
      })

      await gate.openPublishWithGate()

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'comfyhub-profile-gate'
      })
      expect(mockPublishShow).toHaveBeenCalledOnce()
    })

    it('does not open publish dialog when gate is cancelled', async () => {
      mockFlags.comfyHubProfileGateEnabled = true
      mockFetchApi.mockResolvedValue(mockErrorResponse(404))

      mockShowDialog.mockImplementation(({ props }) => {
        props.onClose()
      })

      await gate.openPublishWithGate()

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'comfyhub-profile-gate'
      })
      expect(mockPublishShow).not.toHaveBeenCalled()
    })
  })
})
