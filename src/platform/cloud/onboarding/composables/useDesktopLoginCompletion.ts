import { createSharedComposable, until } from '@vueuse/core'
import type { LocationQuery } from 'vue-router'

import { getDesktopLoginRequest } from '@/platform/cloud/onboarding/desktopLoginBridge'
import { useAuthStore } from '@/stores/authStore'

type OnAuthSuccess = () => Promise<void>
type PendingCompletion = {
  onAuthSuccess: OnAuthSuccess
  promise: Promise<void>
}

function useDesktopLoginCompletionInternal() {
  const authStore = useAuthStore()
  let authInitializedPromise: Promise<void> | null = null
  const pendingCompletions = new Map<string, PendingCompletion>()

  async function waitForAuthInitialized(): Promise<void> {
    if (authStore.isInitialized) return

    authInitializedPromise ??= until(() => authStore.isInitialized)
      .toBe(true)
      .then(() => undefined)
      .finally(() => {
        authInitializedPromise = null
      })

    await authInitializedPromise
  }

  async function completeDesktopLoginForExistingSession(
    query: LocationQuery,
    onAuthSuccess: OnAuthSuccess
  ): Promise<void> {
    const request = getDesktopLoginRequest(query)
    if (!request) return

    const requestKey = `${request.callbackUrl.href}:${request.state}`
    const pendingCompletion = pendingCompletions.get(requestKey)
    if (pendingCompletion) {
      pendingCompletion.onAuthSuccess = onAuthSuccess
      return pendingCompletion.promise
    }

    const completion: PendingCompletion = {
      onAuthSuccess,
      promise: Promise.resolve()
    }

    completion.promise = (async () => {
      await waitForAuthInitialized()
      if (!authStore.currentUser) return

      await completion.onAuthSuccess()
    })().finally(() => {
      if (pendingCompletions.get(requestKey) === completion) {
        pendingCompletions.delete(requestKey)
      }
    })

    pendingCompletions.set(requestKey, completion)
    return completion.promise
  }

  return { completeDesktopLoginForExistingSession }
}

export const useDesktopLoginCompletion = createSharedComposable(
  useDesktopLoginCompletionInternal
)
