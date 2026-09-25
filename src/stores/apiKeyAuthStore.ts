import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/stores/authStore'
import type { ApiKeyAuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'

type ComfyApiUser =
  operations['createCustomer']['responses']['201']['content']['application/json']

const STORAGE_KEY = 'comfy_api_key'

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const authStore = useAuthStore()
  const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
  const toastStore = useToast()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const currentUser = ref<ComfyApiUser | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  const initializeUserFromApiKey = async (watchedApiKey: string) => {
    const createCustomerResponse = await authStore
      .createCustomer()
      .catch((err) => {
        console.error(err)
        return
      })
    if (apiKey.value !== watchedApiKey) return
    if (!createCustomerResponse) {
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

  const reportError = (error: unknown) => {
    if (error instanceof Error && error.message === 'STORAGE_FAILED') {
      toastStore.error(t('auth.apiKey.storageFailed'), {
        description: t('auth.apiKey.storageFailedDetail')
      })
    } else {
      toastErrorHandler(error)
    }
  }

  const storeApiKey = wrapWithErrorHandlingAsync(async (newApiKey: string) => {
    apiKey.value = newApiKey
    toastStore.success(t('auth.apiKey.stored'), {
      description: t('auth.apiKey.storedDetail'),
      duration: 5000
    })
    return true
  }, reportError)

  const clearStoredApiKey = wrapWithErrorHandlingAsync(async () => {
    apiKey.value = null
    toastStore.success(t('auth.apiKey.cleared'), {
      description: t('auth.apiKey.clearedDetail'),
      duration: 5000
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
