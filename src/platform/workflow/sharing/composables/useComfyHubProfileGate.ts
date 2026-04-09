import { ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useComfyHubService } from '@/platform/workflow/sharing/services/comfyHubService'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import type { ComfyHubProfile } from '@/schemas/apiSchema'

// TODO: Migrate to a Pinia store for proper singleton state management
// User-scoped, session-cached profile state (module-level singleton)
const hasProfile = ref<boolean | null>(null)
const isCheckingProfile = ref(false)
const isFetchingProfile = ref(false)
const profile = ref<ComfyHubProfile | null>(null)
const cachedUserId = ref<string | null>(null)
let inflightFetch: Promise<ComfyHubProfile | null> | null = null

export function useComfyHubProfileGate() {
  const { resolvedUserInfo } = useCurrentUser()
  const { toastErrorHandler } = useErrorHandling()
  const {
    getMyProfile,
    requestAssetUploadUrl,
    uploadFileToPresignedUrl,
    createProfile: createComfyHubProfile
  } = useComfyHubService()

  function syncCachedProfileWithCurrentUser(): void {
    const currentUserId = resolvedUserInfo.value?.id ?? null
    if (cachedUserId.value === currentUserId) {
      return
    }

    hasProfile.value = null
    profile.value = null
    cachedUserId.value = currentUserId
  }

  async function performFetch(): Promise<ComfyHubProfile | null> {
    isFetchingProfile.value = true
    try {
      const nextProfile = await getMyProfile()
      if (!nextProfile) {
        hasProfile.value = false
        profile.value = null
        return null
      }
      hasProfile.value = true
      profile.value = nextProfile
      return nextProfile
    } catch (error) {
      hasProfile.value = false
      toastErrorHandler(error)
      return null
    } finally {
      isFetchingProfile.value = false
      inflightFetch = null
    }
  }

  function fetchProfile(options?: {
    force?: boolean
  }): Promise<ComfyHubProfile | null> {
    syncCachedProfileWithCurrentUser()

    if (!options?.force && profile.value) {
      return Promise.resolve(profile.value)
    }

    if (!options?.force && inflightFetch) return inflightFetch

    inflightFetch = performFetch()
    return inflightFetch
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
    profilePicture?: File
  }): Promise<ComfyHubProfile> {
    syncCachedProfileWithCurrentUser()

    const workspaceAuthStore = useWorkspaceAuthStore()
    const workspaceId = workspaceAuthStore.currentWorkspace?.id
    if (!workspaceId) {
      throw new Error('Unable to determine current workspace')
    }

    let avatarToken: string | undefined
    if (data.profilePicture) {
      const contentType = data.profilePicture.type || 'application/octet-stream'
      const upload = await requestAssetUploadUrl({
        filename: data.profilePicture.name,
        contentType
      })

      await uploadFileToPresignedUrl({
        uploadUrl: upload.uploadUrl,
        file: data.profilePicture,
        contentType
      })

      avatarToken = upload.token
    }

    const createdProfile = await createComfyHubProfile({
      workspaceId,
      username: data.username,
      displayName: data.name,
      description: data.description,
      avatarToken
    })

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
