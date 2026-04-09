import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyHubProfile } from '@/schemas/apiSchema'

const mockGetMyProfile = vi.hoisted(() => vi.fn())
const mockRequestAssetUploadUrl = vi.hoisted(() => vi.fn())
const mockUploadFileToPresignedUrl = vi.hoisted(() => vi.fn())
const mockCreateProfile = vi.hoisted(() => vi.fn())
const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockResolvedUserInfo = vi.hoisted(() => ({
  value: { id: 'user-a' }
}))

vi.mock('@/platform/workflow/sharing/services/comfyHubService', () => ({
  useComfyHubService: () => ({
    getMyProfile: mockGetMyProfile,
    requestAssetUploadUrl: mockRequestAssetUploadUrl,
    uploadFileToPresignedUrl: mockUploadFileToPresignedUrl,
    createProfile: mockCreateProfile
  })
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

function setCurrentWorkspace(workspaceId: string) {
  sessionStorage.setItem(
    'Comfy.Workspace.Current',
    JSON.stringify({
      id: workspaceId,
      type: 'team',
      name: 'Test Workspace',
      role: 'owner'
    })
  )
}

describe('useComfyHubProfileGate', () => {
  let gate: ReturnType<typeof useComfyHubProfileGate>

  beforeEach(() => {
    vi.clearAllMocks()
    mockResolvedUserInfo.value = { id: 'user-a' }
    setCurrentWorkspace('workspace-1')
    mockGetMyProfile.mockResolvedValue(mockProfile)
    mockRequestAssetUploadUrl.mockResolvedValue({
      uploadUrl: 'https://upload.example.com/avatar.png',
      publicUrl: 'https://cdn.example.com/avatar.png',
      token: 'avatar-token'
    })
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined)
    mockCreateProfile.mockResolvedValue(mockProfile)

    // Reset module-level singleton refs
    gate = useComfyHubProfileGate()
    gate.hasProfile.value = null
    gate.profile.value = null
    gate.isCheckingProfile.value = false
    gate.isFetchingProfile.value = false
  })

  describe('fetchProfile', () => {
    it('fetches profile from /hub/profiles/me', async () => {
      const profile = await gate.fetchProfile()

      expect(profile).toEqual(mockProfile)
      expect(gate.hasProfile.value).toBe(true)
      expect(gate.profile.value).toEqual(mockProfile)
      expect(mockGetMyProfile).toHaveBeenCalledOnce()
    })

    it('reuses cached profile state per user', async () => {
      await gate.fetchProfile()
      await gate.fetchProfile()
      expect(mockGetMyProfile).toHaveBeenCalledTimes(1)

      mockResolvedUserInfo.value = { id: 'user-b' }
      await gate.fetchProfile()

      expect(mockGetMyProfile).toHaveBeenCalledTimes(2)
    })

    it('sets hasProfile to false when fetch throws', async () => {
      mockGetMyProfile.mockRejectedValue(new Error('Network error'))

      await gate.fetchProfile()

      expect(gate.hasProfile.value).toBe(false)
      expect(gate.profile.value).toBe(null)
      expect(mockToastErrorHandler).toHaveBeenCalledOnce()
    })

    it('sets isFetchingProfile during fetch', async () => {
      let resolvePromise: (v: ComfyHubProfile | null) => void
      mockGetMyProfile.mockReturnValue(
        new Promise<ComfyHubProfile | null>((resolve) => {
          resolvePromise = resolve
        })
      )

      const promise = gate.fetchProfile()
      expect(gate.isFetchingProfile.value).toBe(true)

      resolvePromise!(mockProfile)
      await promise

      expect(gate.isFetchingProfile.value).toBe(false)
    })
  })

  describe('checkProfile', () => {
    it('returns true when API responds ok', async () => {
      mockGetMyProfile.mockResolvedValue(mockProfile)

      const result = await gate.checkProfile()

      expect(result).toBe(true)
      expect(gate.hasProfile.value).toBe(true)
    })

    it('returns false when no profile exists', async () => {
      mockGetMyProfile.mockResolvedValue(null)

      const result = await gate.checkProfile()

      expect(result).toBe(false)
      expect(gate.hasProfile.value).toBe(false)
    })
  })

  describe('createProfile', () => {
    it('creates profile with workspace_id and avatar token', async () => {
      const profilePicture = new File(['img'], 'avatar.png')

      await gate.createProfile({
        username: 'testuser',
        name: 'Test User',
        description: 'Hello',
        profilePicture
      })

      expect(mockCreateProfile).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        username: 'testuser',
        displayName: 'Test User',
        description: 'Hello',
        avatarToken: 'avatar-token'
      })
    })

    it('uploads avatar via upload-url + PUT before create', async () => {
      const profilePicture = new File(['img'], 'avatar.png', {
        type: 'image/png'
      })

      await gate.createProfile({
        username: 'testuser',
        profilePicture
      })

      expect(mockRequestAssetUploadUrl).toHaveBeenCalledWith({
        filename: 'avatar.png',
        contentType: 'image/png'
      })
      expect(mockUploadFileToPresignedUrl).toHaveBeenCalledWith({
        uploadUrl: 'https://upload.example.com/avatar.png',
        file: profilePicture,
        contentType: 'image/png'
      })
      const requestCallOrder =
        mockRequestAssetUploadUrl.mock.invocationCallOrder
      const uploadCallOrder =
        mockUploadFileToPresignedUrl.mock.invocationCallOrder
      const createCallOrder = mockCreateProfile.mock.invocationCallOrder
      expect(requestCallOrder[0]).toBeLessThan(uploadCallOrder[0])
      expect(uploadCallOrder[0]).toBeLessThan(createCallOrder[0])
    })

    it('throws when workspace context is missing from sessionStorage', async () => {
      sessionStorage.removeItem('Comfy.Workspace.Current')

      await expect(
        gate.createProfile({ username: 'testuser' })
      ).rejects.toThrow('Unable to determine current workspace')

      expect(mockCreateProfile).not.toHaveBeenCalled()
    })

    it('throws when workspace JSON is malformed', async () => {
      sessionStorage.setItem('Comfy.Workspace.Current', '{invalid')

      await expect(
        gate.createProfile({ username: 'testuser' })
      ).rejects.toThrow('Unable to determine current workspace')

      expect(mockCreateProfile).not.toHaveBeenCalled()
    })

    it('throws when workspace object has no id', async () => {
      sessionStorage.setItem(
        'Comfy.Workspace.Current',
        JSON.stringify({ type: 'personal', name: 'My Workspace' })
      )

      await expect(
        gate.createProfile({ username: 'testuser' })
      ).rejects.toThrow('Unable to determine current workspace')

      expect(mockCreateProfile).not.toHaveBeenCalled()
    })

    it('creates profile without avatar when no picture provided', async () => {
      await gate.createProfile({
        username: 'testuser',
        name: 'Test User'
      })

      expect(mockRequestAssetUploadUrl).not.toHaveBeenCalled()
      expect(mockUploadFileToPresignedUrl).not.toHaveBeenCalled()
      expect(mockCreateProfile).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        username: 'testuser',
        displayName: 'Test User',
        description: undefined,
        avatarToken: undefined
      })
    })

    it('updates cached state after successful creation', async () => {
      expect(gate.hasProfile.value).toBe(null)
      expect(gate.profile.value).toBe(null)

      await gate.createProfile({ username: 'testuser' })

      expect(gate.hasProfile.value).toBe(true)
      expect(gate.profile.value).toEqual(mockProfile)
    })
  })
})
