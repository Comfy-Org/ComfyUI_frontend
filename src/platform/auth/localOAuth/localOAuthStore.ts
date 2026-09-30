import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import type { AuthHeader } from '@/types/authTypes'

import type { LocalOAuthSession } from './localOAuthClient'
import {
  LocalOAuthTokenError,
  exchangeAuthorizationCode,
  refreshSession
} from './localOAuthClient'
import type { CallbackResult } from './pkce'
import {
  LOCAL_OAUTH_CHANNEL,
  buildAuthorizeUrl,
  createPendingAuthorization,
  validateCallback
} from './pkce'

const STORAGE_KEY = 'Comfy.LocalOAuth.Session'
const REFRESH_LOCK = 'Comfy.LocalOAuth.Refresh'
const REFRESH_LEEWAY_MS = 60_000
const SIGN_IN_TIMEOUT_MS = 5 * 60_000

export type BrowserSignInResult =
  | 'signed_in'
  | 'popup_blocked'
  | 'timed_out'
  | 'cancelled'
  | 'denied'
  | 'failed'

type CallbackOutcome = CallbackResult | 'timed_out' | 'cancelled'

function isSession(value: unknown): value is LocalOAuthSession {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.expiresAt === 'number' &&
    typeof record.cloudBaseUrl === 'string' &&
    typeof record.userId === 'string'
  )
}

/** Reads storage directly: another tab may have rotated the refresh token. */
function readStoredSession(): LocalOAuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Refresh tokens rotate with reuse detection, so tabs must not refresh at once.
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? locks.request(REFRESH_LOCK, fn) : fn()
}

function waitForCallback(
  state: string,
  signal: AbortSignal
): Promise<CallbackOutcome> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(LOCAL_OAUTH_CHANNEL)
    const finish = (outcome: CallbackOutcome) => {
      clearTimeout(timer)
      channel.close()
      resolve(outcome)
    }
    const timer = setTimeout(() => finish('timed_out'), SIGN_IN_TIMEOUT_MS)
    signal.addEventListener('abort', () => finish('cancelled'), { once: true })
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const result = validateCallback(event.data, state)
      if (!result.ok && result.reason === 'ignored') return
      finish(result)
    }
  })
}

/**
 * Comfy account session for local ComfyUI obtained through the cloud OAuth
 * server (authorization code + PKCE), so SSO users without a Firebase account
 * can sign in. Local builds only.
 */
export const useLocalOAuthStore = defineStore('localOAuth', () => {
  const session = useLocalStorage<LocalOAuthSession | null>(STORAGE_KEY, null, {
    serializer: StorageSerializers.object
  })
  const isAuthenticated = computed(() => session.value !== null)
  const userId = computed(() => session.value?.userId ?? null)
  const email = computed(() => session.value?.email)

  let pendingSignIn: AbortController | null = null
  let inFlightRefresh: Promise<string | undefined> | null = null

  async function signIn(): Promise<BrowserSignInResult> {
    pendingSignIn?.abort()
    // Opened before any await so the click still counts as a user gesture.
    const popup = window.open('', 'comfy-browser-sign-in', 'popup')
    if (!popup) return 'popup_blocked'
    const controller = new AbortController()
    pendingSignIn = controller

    const cloudBaseUrl = getComfyCloudBaseUrl()
    const pending = createPendingAuthorization(window.location.origin)
    const outcome = waitForCallback(pending.state, controller.signal)
    popup.location.href = await buildAuthorizeUrl(cloudBaseUrl, pending)

    const result = await outcome
    if (pendingSignIn === controller) pendingSignIn = null
    if (typeof result === 'string') return result
    if (!result.ok) return result.reason === 'denied' ? 'denied' : 'failed'

    try {
      session.value = await exchangeAuthorizationCode(cloudBaseUrl, {
        code: result.code,
        verifier: pending.verifier,
        redirectUri: pending.redirectUri
      })
      return 'signed_in'
    } catch (error: unknown) {
      console.error('Browser sign-in code exchange failed', error)
      return 'failed'
    }
  }

  const refreshUnderLock = () =>
    withRefreshLock(async (): Promise<string | undefined> => {
      const stored = readStoredSession()
      if (!stored) {
        session.value = null
        return undefined
      }
      if (stored.expiresAt - Date.now() > REFRESH_LEEWAY_MS) {
        session.value = stored
        return stored.accessToken
      }
      try {
        const next = await refreshSession(stored)
        // Signed out (or replaced) while refreshing: don't resurrect it.
        if (readStoredSession()?.refreshToken !== stored.refreshToken) {
          return undefined
        }
        session.value = next
        return next.accessToken
      } catch (error: unknown) {
        if (error instanceof LocalOAuthTokenError && error.isGrantInvalid) {
          session.value = null
        }
        return undefined
      }
    })

  /**
   * Current access token, refreshed near expiry. Resolves undefined when
   * signed out or when refresh fails (e.g. offline), so local runs proceed.
   */
  async function getAccessToken(): Promise<string | undefined> {
    const current = session.value
    if (!current) return undefined
    if (current.expiresAt - Date.now() > REFRESH_LEEWAY_MS) {
      return current.accessToken
    }
    inFlightRefresh ??= refreshUnderLock().finally(() => {
      inFlightRefresh = null
    })
    return inFlightRefresh
  }

  async function getAuthHeader(): Promise<AuthHeader | null> {
    const token = await getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  function signOut() {
    pendingSignIn?.abort()
    pendingSignIn = null
    session.value = null
  }

  return {
    isAuthenticated,
    userId,
    email,
    signIn,
    signOut,
    getAccessToken,
    getAuthHeader
  }
})
