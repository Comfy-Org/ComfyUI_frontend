import { ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { ComfyHubProfile } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'

import { useComfyHubPublishDialog } from './useComfyHubPublishDialog'
import { useShareDialog } from './useShareDialog'

const PROFILE_GATE_DIALOG_KEY = 'comfyhub-profile-gate'

// User-scoped, session-cached profile state (module-level singleton)
const hasProfile = ref<boolean | null>(null)
const isCheckingProfile = ref(false)
const cachedUserId = ref<string | null>(null)

function mapHubProfileResponse(payload: unknown): ComfyHubProfile {
  const data = payload as Record<string, unknown>

  return {
    username: typeof data.username === 'string' ? data.username : '',
    name: typeof data.name === 'string' ? data.name : undefined,
    description:
      typeof data.description === 'string' ? data.description : undefined,
    coverImageUrl:
      typeof data.coverImageUrl === 'string'
        ? data.coverImageUrl
        : typeof data.cover_image_url === 'string'
          ? data.cover_image_url
          : undefined,
    profilePictureUrl:
      typeof data.profilePictureUrl === 'string'
        ? data.profilePictureUrl
        : typeof data.profile_picture_url === 'string'
          ? data.profile_picture_url
          : undefined
  }
}

export function useComfyHubProfileGate() {
  const { resolvedUserInfo } = useCurrentUser()
  const { flags } = useFeatureFlags()
  const publishDialog = useComfyHubPublishDialog()
  const shareDialog = useShareDialog()
  const dialogStore = useDialogStore()

  function syncCachedProfileWithCurrentUser(): void {
    const currentUserId = resolvedUserInfo.value?.id ?? null
    if (cachedUserId.value === currentUserId) {
      return
    }

    hasProfile.value = null
    cachedUserId.value = currentUserId
  }

  async function checkProfile(): Promise<boolean> {
    syncCachedProfileWithCurrentUser()

    if (hasProfile.value !== null) return hasProfile.value
    isCheckingProfile.value = true
    try {
      const response = await api.fetchApi('/hub/profile')
      hasProfile.value = response.ok
      return hasProfile.value
    } catch {
      hasProfile.value = false
      return false
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
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message ?? 'Failed to create profile')
    }

    const profile = mapHubProfileResponse(await response.json())
    hasProfile.value = true
    return profile
  }

  async function showProfileGateDialog(): Promise<'complete' | 'cancel'> {
    const { default: ComfyHubProfileGateDialog } =
      await import('@/platform/workflow/sharing/components/comfyhub/profile/ComfyHubProfileGateDialog.vue')

    return new Promise<'complete' | 'cancel'>((resolve) => {
      dialogStore.showDialog({
        key: PROFILE_GATE_DIALOG_KEY,
        component: ComfyHubProfileGateDialog,
        props: {
          onComplete: () => resolve('complete'),
          onClose: () => resolve('cancel')
        },
        dialogComponentProps: {
          headless: true,
          modal: true,
          closable: true,
          dismissableMask: true,
          onClose: () => resolve('cancel'),
          pt: {
            root: {
              class: 'rounded-2xl overflow-hidden w-full sm:w-144 max-w-full'
            },
            header: { class: 'p-0! hidden' },
            content: { class: 'p-0! m-0!' }
          }
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key: PROFILE_GATE_DIALOG_KEY })
      return result
    })
  }

  async function ensurePublishAccess(options?: {
    hideShareDialogOnGate?: boolean
  }): Promise<boolean> {
    if (!flags.comfyHubProfileGateEnabled) {
      return true
    }

    const profileExists = await checkProfile()
    if (profileExists) {
      return true
    }

    if (options?.hideShareDialogOnGate ?? false) {
      shareDialog.hide()
    }

    const result = await showProfileGateDialog()
    return result === 'complete'
  }

  async function openPublishWithGate() {
    const hasPublishAccess = await ensurePublishAccess({
      hideShareDialogOnGate: true
    })
    if (hasPublishAccess) {
      publishDialog.show()
    }
  }

  return {
    hasProfile,
    isCheckingProfile,
    checkProfile,
    createProfile,
    ensurePublishAccess,
    openPublishWithGate
  }
}
