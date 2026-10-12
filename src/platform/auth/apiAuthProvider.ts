import type { AuthHeader } from '@/types/authTypes'

export interface RetrySignalLifecycle {
  clearInitialTimeout: () => void
  createSignal: () => AbortSignal | undefined
}

/**
 * Credentials and retry policy the API client applies to every request.
 * The client itself knows nothing about Firebase or workspace sessions;
 * the composition root installs a provider for the current distribution.
 */
export interface ApiAuthProvider {
  waitForInitialization(): Promise<void>
  getAuthHeader(): Promise<AuthHeader | null>
  getAuthToken(): Promise<string | undefined>
  shouldRetryOn401(): Promise<boolean>
  fetch(
    input: RequestInfo | URL,
    init: RequestInit,
    retryOn401: boolean,
    retrySignalLifecycle?: RetrySignalLifecycle
  ): Promise<Response>
}

export const anonymousApiAuthProvider: ApiAuthProvider = {
  waitForInitialization: async () => {},
  getAuthHeader: async () => null,
  getAuthToken: async () => undefined,
  shouldRetryOn401: async () => false,
  fetch: (input, init) => fetch(input, init)
}
