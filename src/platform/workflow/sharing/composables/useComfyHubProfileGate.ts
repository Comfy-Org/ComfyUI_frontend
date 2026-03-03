import { ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { zHubProfileResponse } from '@/platform/workflow/sharing/schemas/shareSchemas'
import type { ComfyHubProfile } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

// User-scoped, session-cached profile state (module-level singleton)
const hasProfile = ref<boolean | null>(null)
const isCheckingProfile = ref(false)
const isFetchingProfile = ref(false)
const profile = ref<ComfyHubProfile | null>(null)
const cachedUserId = ref<string | null>(null)

function mapHubProfileResponse(payload: unknown): ComfyHubProfile {
  const result = zHubProfileResponse.safeParse(payload)
  if (result.success) return result.data
  return {
    username: '',
    name: undefined,
    description: undefined,
    coverImageUrl: undefined,
    profilePictureUrl: undefined
  }
}

export function useComfyHubProfileGate() {
  const { resolvedUserInfo } = useCurrentUser()

  function syncCachedProfileWithCurrentUser(): void {
    const currentUserId = resolvedUserInfo.value?.id ?? null
    if (cachedUserId.value === currentUserId) {
      return
    }

    hasProfile.value = null
    profile.value = null
    cachedUserId.value = currentUserId
  }

  async function fetchProfile(options?: {
    force?: boolean
  }): Promise<ComfyHubProfile | null> {
    syncCachedProfileWithCurrentUser()

    if (!options?.force && profile.value) {
      return profile.value
    }

    isFetchingProfile.value = true
    try {
      const response = await api.fetchApi('/hub/profile')
      if (!response.ok) {
        hasProfile.value = false
        profile.value = null
        return null
      }

      const nextProfile = mapHubProfileResponse(await response.json())
      hasProfile.value = true
      profile.value = nextProfile
      return nextProfile
    } catch {
      hasProfile.value = false
      profile.value = null
      return null
    } finally {
      isFetchingProfile.value = false
    }
  }

  async function checkProfile(): Promise<boolean> {
    syncCachedProfileWithCurrentUser()

    if (hasProfile.value !== null) return hasProfile.value
    isCheckingProfile.value = true
    try {
      const fetchedProfile = await fetchProfile()
      return fetchedProfile !== null
    } finally {
      isCheckingProfile.value = false
    }
  }

  async function createProfile(data: {
    username: string
    name?: string
    description?: string
    coverImage?: File
    profilePicture?: File
  }): Promise<ComfyHubProfile> {
    syncCachedProfileWithCurrentUser()

    const formData = new FormData()
    formData.append('username', data.username)
    if (data.name) formData.append('name', data.name)
    if (data.description) formData.append('description', data.description)
    if (data.coverImage) formData.append('cover_image', data.coverImage)
    if (data.profilePicture)
      formData.append('profile_picture', data.profilePicture)

    const response = await api.fetchApi('/hub/profile', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({}))
      const message =
        body && typeof body === 'object' && 'message' in body
          ? String((body as Record<string, unknown>).message)
          : 'Failed to create profile'
      throw new Error(message)
    }

    const createdProfile = mapHubProfileResponse(await response.json())
    hasProfile.value = true
    profile.value = createdProfile
    return createdProfile
  }

  return {
    hasProfile,
    profile,
    isCheckingProfile,
    isFetchingProfile,
    checkProfile,
    fetchProfile,
    createProfile
  }
}
