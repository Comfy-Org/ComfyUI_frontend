import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { t } from '@/i18n'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import type { ApiKeyAuthHeader } from '@/types/authTypes'
import type { operations } from '@/types/comfyRegistryTypes'

type ComfyApiUser =
  operations['createCustomer']['responses']['201']['content']['application/json']

const STORAGE_KEY = 'comfy_api_key'

/** Only a rejected key is discarded; the other two are kept and can be retried. */
type ApiKeyFailure = 'rejected' | 'denied' | 'unverified'

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

/**
 * 401 is the API saying it does not accept this key. 403 accepts the key and
 * refuses the account (no permission on the workspace, a plan that excludes
 * key auth), so the key itself is still good and must survive.
 */
const failureFor = (error: unknown): ApiKeyFailure => {
  if (!(error instanceof AuthStoreError)) return 'unverified'
  if (error.status === 401) return 'rejected'
  if (error.status === 403) return 'denied'
  return 'unverified'
}

/**
 * Pairs the failure kind with the status that produced it so the cases stay
 * separable when reported: a rise in `unverified_503` is the backend declining
 * to vouch for keys, a different incident from a rise in `rejected_401`.
 */
const errorCodeFor = (error: unknown, failure: ApiKeyFailure) =>
  error instanceof AuthStoreError && error.status
    ? `${failure}_${error.status}`
    : failure

/**
 * Reports every failure, including the unverified one the watch only logs, so
 * the case that made BE-7550 invisible is the case this can be alerted on.
 * Isolated because the dispatcher is a bare interface with no no-throw
 * guarantee, and a reporting fault must never decide what happens to the key.
 */
const reportFailure = (error: unknown, failure: ApiKeyFailure) => {
  try {
    useTelemetry()?.trackAuthFailed({
      error_code: errorCodeFor(error, failure),
      auth_action: 'api_key_sign_in'
    })
  } catch (reportingError) {
    console.error('Failed to report API key sign-in failure', reportingError)
  }
}

const FAILURE_MESSAGES: Record<
  ApiKeyFailure,
  { summary: string; detail: string }
> = {
  rejected: {
    summary: 'auth.apiKey.invalid',
    detail: 'auth.login.noAssociatedUser'
  },
  denied: {
    summary: 'auth.apiKey.notPermitted',
    detail: 'auth.apiKey.notPermittedDetail'
  },
  unverified: {
    summary: 'auth.apiKey.verificationUnavailable',
    detail: 'auth.apiKey.verificationUnavailableDetail'
  }
}

export const useApiKeyAuthStore = defineStore('apiKeyAuth', () => {
  const authStore = useAuthStore()
  const apiKey = useLocalStorage<string | null>(STORAGE_KEY, null)
  const toastStore = useToastStore()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const currentUser = ref<ComfyApiUser | null>(null)
  const isAuthenticated = computed(() => !!currentUser.value)

  // Validation started for a key the app restored at launch can still be in
  // flight when the user signs in with a different key. Whichever request
  // started last owns the outcome, so an earlier one that lands afterwards is
  // dropped instead of clearing the newer key or reporting its stale verdict.
  let latestRequest = 0

  const resolveUser = async (): Promise<boolean> => {
    const request = ++latestRequest
    const validated = apiKey.value
    // Whoever we were signed in as belonged to the previous key. Holding onto
    // it would report that identity as authenticated while requests already
    // carry the replacement key.
    currentUser.value = null
    // Clearing the key does not start a request, so the token alone would let
    // an attempt that began earlier still sign the user back in afterwards.
    const stillWanted = () =>
      request === latestRequest && apiKey.value === validated
    try {
      const user = await authStore.createCustomer()
      if (!stillWanted()) return false
      currentUser.value = user
      return true
    } catch (error) {
      if (!stillWanted()) return false
      currentUser.value = null
      const failure = failureFor(error)
      reportFailure(error, failure)
      if (failure === 'rejected') apiKey.value = null
      const { summary, detail } = FAILURE_MESSAGES[failure]
      throw new ApiKeyAuthError(failure, t(summary), t(detail))
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

  // True while storeApiKey is driving the check itself. It keeps the write it
  // makes to `apiKey` from having the watch below repeat the same POST and
  // report the same failure twice, and it lets the form disable submission for
  // the duration rather than letting a second attempt race the first.
  const isValidating = ref(false)

  watch(
    apiKey,
    () => {
      if (!apiKey.value) {
        currentUser.value = null
        return
      }
      if (isValidating.value) return
      // A stored key the backend rejects or refuses is the user's problem to
      // fix; a backend that is merely unreachable is not worth a startup toast.
      void resolveUser().catch((error: unknown) => {
        if (
          error instanceof ApiKeyAuthError &&
          error.failure !== 'unverified'
        ) {
          reportError(error)
        } else {
          console.error(error)
        }
      })
    },
    { immediate: true }
  )

  const storeApiKey = wrapWithErrorHandlingAsync(async (newApiKey: string) => {
    if (isValidating.value) return false
    isValidating.value = true
    let signedIn: boolean
    try {
      apiKey.value = newApiKey
      signedIn = await resolveUser()
    } finally {
      isValidating.value = false
    }
    if (!signedIn) return false
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
