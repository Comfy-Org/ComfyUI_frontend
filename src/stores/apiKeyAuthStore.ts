import { useLocalStorage } from '@vueuse/core'
import type { UserResponse } from '@comfyorg/ingest-types'
import { defineStore } from 'pinia'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useAuthStore } from '@/stores/authStore'
import type { ApiKeyAuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'

type ComfyApiUser =
  operations['createCustomer']['responses']['201']['content']['application/json']

const STORAGE_KEY = 'comfy_api_key'

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const authStore = useAuthStore()
  const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const currentUser = ref<ComfyApiUser | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)
  const validation = shallowRef<{
    key: string
    requestId: symbol
    result: Promise<boolean>
  } | null>(null)
  const isValidating = computed(() => validation.value !== null)

  async function getCloudUser(): Promise<ComfyApiUser | undefined> {
    const response = await api.fetchApi('/user')
    if (response.status === 401 || response.status === 403) return
    if (!response.ok) {
      throw new Error(
        t('auth.apiKey.validationFailed', { status: response.status })
      )
    }
    const user: UserResponse = await response.json()
    return { id: user.id }
  }

  function initializeUserFromApiKey(watchedApiKey: string): Promise<boolean> {
    if (validation.value?.key === watchedApiKey) {
      return validation.value.result
    }
    const requestId = Symbol()
    const result = (async () => {
      try {
        const user = await (isCloud
          ? getCloudUser()
          : authStore.createCustomer())
        if (
          apiKey.value !== watchedApiKey ||
          validation.value?.requestId !== requestId
        ) {
          return false
        }
        if (!user) {
          reportError(new Error(t('auth.login.noAssociatedUser')))
          apiKey.value = null
          return false
        }
        currentUser.value = user
        return true
      } catch (error) {
        if (
          apiKey.value === watchedApiKey &&
          validation.value?.requestId === requestId
        ) {
          reportError(error)
        }
        return false
      } finally {
        if (validation.value?.requestId === requestId) validation.value = null
      }
    })()
    validation.value = { key: watchedApiKey, requestId, result }
    return result
  }

  // The stored key and its validated user form one session value: replacing
  // the key ends the previous user's session immediately instead of exposing
  // the old user while the new key validates.
  watch(
    apiKey,
    async (watchedApiKey) => {
      currentUser.value = null
      validation.value = null
      if (watchedApiKey) {
        await nextTick()
        if (apiKey.value !== watchedApiKey) return
        void initializeUserFromApiKey(watchedApiKey)
      }
    },
    { immediate: true, flush: 'sync' }
  )

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
    const normalizedKey = newApiKey.trim()
    apiKey.value = normalizedKey
    await nextTick()
    if (apiKey.value !== normalizedKey) return false
    const validated = await initializeUserFromApiKey(normalizedKey)
    if (!validated || apiKey.value !== normalizedKey || !currentUser.value) {
      return false
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
    isValidating,

    // Actions
    storeApiKey,
    clearStoredApiKey,
    getAuthHeader,
    getApiKey
  }
})
