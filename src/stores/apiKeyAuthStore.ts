import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthStoreAccess } from '@/platform/auth/authStoreAccess'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ApiKeyAuthHeader } from '@comfyorg/api-client/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'

type ComfyApiUser =
  operations['createCustomer']['responses']['201']['content']['application/json']

const STORAGE_KEY = 'comfy_api_key'

const isRejectedApiKey = (error: unknown) =>
  error instanceof Error &&
  error.name === 'AuthStoreError' &&
  'status' in error &&
  (error.status === 401 || error.status === 403)

const SAVE_FAILURE_DETAIL = {
  gone: 'auth.apiKey.storedForSessionDetail',
  kept: 'auth.apiKey.storedForSessionPreviousKeptDetail',
  unreadable: 'auth.apiKey.storedForSessionBlockedDetail'
} as const

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const authStore = useAuthStoreAccess()
  let storageFailureReported = false
  const reportStorageFailure = (error: unknown) => {
    if (storageFailureReported) return
    storageFailureReported = true
    reportError(error, {
      surface: 'auth',
      errorType: 'api_key_storage_failed',
      level: 'warning'
    })
  }

  const readPersistedKey = (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch (error) {
      reportStorageFailure(error)
      return null
    }
  }

  const apiKey = ref<string | null>(readPersistedKey())

  useEventListener(window, 'storage', (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    try {
      if (event.storageArea !== localStorage) return
    } catch {
      return
    }
    apiKey.value = event.newValue
  })

  const persistKey = (key: string): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, key)
      return true
    } catch (error) {
      reportStorageFailure(error)
      return false
    }
  }

  const forgetPersistedKey = (): 'gone' | 'kept' | 'unreadable' => {
    let stored: string | null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch (error) {
      reportStorageFailure(error)
      return 'unreadable'
    }
    if (stored === null) return 'gone'
    try {
      localStorage.removeItem(STORAGE_KEY)
      return 'gone'
    } catch (error) {
      reportStorageFailure(error)
      return 'kept'
    }
  }
  const toast = useToast()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const currentUser = ref<ComfyApiUser | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  const initializeUserFromApiKey = async (watchedApiKey: string) => {
    const createCustomerResponse = await authStore
      .createCustomer()
      .catch((err: unknown) => {
        if (isRejectedApiKey(err)) {
          console.warn(err)
          return
        }
        reportError(err, {
          errorType: 'api_key_customer_creation_failure',
          surface: 'auth'
        })
      })
    if (apiKey.value !== watchedApiKey) return
    if (!createCustomerResponse) {
      forgetPersistedKey()
      apiKey.value = null
      throw new Error(t('auth.login.noAssociatedUser'))
    }
    currentUser.value = createCustomerResponse
  }

  // The stored key and its validated user form one session value: replacing
  // the key ends the previous user's session immediately instead of exposing
  // the old user while the new key validates.
  watch(
    apiKey,
    async (watchedApiKey) => {
      currentUser.value = null
      if (watchedApiKey) {
        await nextTick()
        if (apiKey.value !== watchedApiKey) return
        void initializeUserFromApiKey(watchedApiKey)
      }
    },
    { immediate: true }
  )

  const showErrorToast = (error: unknown) => {
    if (error instanceof Error && error.message === 'STORAGE_FAILED') {
      toast.error(t('auth.apiKey.storageFailed'), {
        description: t('auth.apiKey.storageFailedDetail')
      })
    } else {
      toastErrorHandler(error)
    }
  }

  const storeApiKey = wrapWithErrorHandlingAsync(async (newApiKey: string) => {
    const persisted = persistKey(newApiKey)
    apiKey.value = newApiKey
    if (!persisted) {
      toast.warning(t('auth.apiKey.storedForSession'), {
        description: t(SAVE_FAILURE_DETAIL[forgetPersistedKey()]),
        duration: 8000
      })
      return true
    }
    toast.success(t('auth.apiKey.stored'), {
      description: t('auth.apiKey.storedDetail'),
      duration: 5000
    })
    return true
  }, showErrorToast)

  const clearStoredApiKey = wrapWithErrorHandlingAsync(async () => {
    const removal = forgetPersistedKey()
    apiKey.value = null
    if (removal !== 'gone') {
      toast.warning(t('auth.apiKey.clearedForSession'), {
        description: t(
          removal === 'kept'
            ? 'auth.apiKey.clearedForSessionDetail'
            : 'auth.apiKey.clearedForSessionBlockedDetail'
        ),
        duration: 8000
      })
      return true
    }
    toast.success(t('auth.apiKey.cleared'), {
      description: t('auth.apiKey.clearedDetail'),
      duration: 5000
    })
    return true
  }, showErrorToast)

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
