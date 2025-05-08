import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

const STORAGE_KEY = 'comfy_api_key'

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const reportError = (error: unknown) => {
    if (error instanceof Error && error.message === 'STORAGE_FAILED') {
      toastStore.add({
        severity: 'error',
        summary: t('auth.apiKey.storageFailed'),
        detail: t('auth.apiKey.storageFailedDetail')
      })
    } else {
      toastErrorHandler(error)
    }
  }

  const storeApiKey = wrapWithErrorHandlingAsync(async (newApiKey: string) => {
    apiKey.value = newApiKey
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

  const getAuthHeader = () => {
    const comfyOrgApiKey = getApiKey()
    if (comfyOrgApiKey) {
      return {
        'X-COMFY-API-KEY': comfyOrgApiKey
      }
    }
    return null
  }

  return {
    hasApiKey: computed(() => !!apiKey.value),
    storeApiKey,
    clearStoredApiKey,
    getAuthHeader,
    getApiKey
  }
})
