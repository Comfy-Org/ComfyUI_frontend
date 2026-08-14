import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import type { ApiKeyAuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'

type ComfyApiUser =
  operations['createCustomer']['responses']['201']['content']['application/json']

const STORAGE_KEY = 'comfy_api_key'

/** A rejected key is discarded; an unverified one is kept so it can be retried. */
type ApiKeyFailure = 'rejected' | 'unverified'

class ApiKeyAuthError extends Error {
  constructor(
    readonly failure: ApiKeyFailure,
    readonly summary: string,
    readonly detail: string
  ) {
    super(detail)
    this.name = 'ApiKeyAuthError'
  }
}

const isKeyRejection = (error: unknown) =>
  error instanceof AuthStoreError &&
  (error.status === 401 || error.status === 403)

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const authStore = useAuthStore()
  const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const currentUser = ref<ComfyApiUser | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  const resolveUser = async () => {
    try {
      currentUser.value = await authStore.createCustomer()
    } catch (error) {
      currentUser.value = null
      if (isKeyRejection(error)) {
        apiKey.value = null
        throw new ApiKeyAuthError(
          'rejected',
          t('auth.apiKey.invalid'),
          t('auth.login.noAssociatedUser')
        )
      }
      throw new ApiKeyAuthError(
        'unverified',
        t('auth.apiKey.verificationUnavailable'),
        t('auth.apiKey.verificationUnavailableDetail')
      )
    }
  }

  const reportError = (error: unknown) => {
    if (error instanceof ApiKeyAuthError) {
      toastStore.add({
        severity: 'error',
        summary: error.summary,
        detail: error.detail
      })
    } else if (error instanceof Error && error.message === 'STORAGE_FAILED') {
      toastStore.add({
        severity: 'error',
        summary: t('auth.apiKey.storageFailed'),
        detail: t('auth.apiKey.storageFailedDetail')
      })
    } else {
      toastErrorHandler(error)
    }
  }

  // Set while storeApiKey drives the check itself, so the write it makes to
  // `apiKey` does not have the watch below repeat the same POST and report the
  // same failure twice.
  let signingIn = false

  watch(
    apiKey,
    () => {
      if (!apiKey.value) {
        currentUser.value = null
        return
      }
      if (signingIn) return
      // A stored key the backend now rejects is the user's problem to fix, but
      // a backend that is merely unreachable is not worth a startup toast.
      void resolveUser().catch((error: unknown) => {
        if (error instanceof ApiKeyAuthError && error.failure === 'rejected') {
          reportError(error)
        } else {
          console.error(error)
        }
      })
    },
    { immediate: true }
  )

  const storeApiKey = wrapWithErrorHandlingAsync(async (newApiKey: string) => {
    signingIn = true
    try {
      apiKey.value = newApiKey
      await resolveUser()
    } finally {
      signingIn = false
    }
    toastStore.add({
      severity: 'success',
      summary: t('auth.apiKey.stored'),
      detail: t('auth.apiKey.storedDetail'),
      life: 5000
    })
    return true
  }, reportError)

  const clearStoredApiKey = wrapWithErrorHandlingAsync(async () => {
    apiKey.value = null
    toastStore.add({
      severity: 'success',
      summary: t('auth.apiKey.cleared'),
      detail: t('auth.apiKey.clearedDetail'),
      life: 5000
    })
    return true
  }, reportError)

  const getApiKey = () => apiKey.value

  /**
   * Retrieves the appropriate authentication header for API requests if an
   * API key is available, otherwise returns null.
   */
  const getAuthHeader = (): ApiKeyAuthHeader | null => {
    const comfyOrgApiKey = getApiKey()
    if (comfyOrgApiKey) {
      return {
        'X-API-KEY': comfyOrgApiKey
      }
    }
    return null
  }

  return {
    // State
    currentUser,
    isAuthenticated,

    // Actions
    storeApiKey,
    clearStoredApiKey,
    getAuthHeader,
    getApiKey
  }
})
