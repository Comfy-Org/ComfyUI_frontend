import { until } from '@vueuse/core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  readsSignedInWebSession,
  useCloudWebSessionStore
} from '@/platform/auth/session/cloudWebSessionStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

export type CloudSignIn = 'signed_in' | 'signed_out' | 'pending'

const DIFFERENT_LOGIN_SIGN_OUT_TIMEOUT_MS = 5_000

const boots = new WeakMap<object, Promise<void>>()

/** With SSO on, a signed-in session outranks a stored key; the key stays the fallback. */
async function storedApiKeyIsTheLogin(): Promise<boolean> {
  if (useApiKeyAuthStore().getApiKey() === null) return false
  const { flags } = useFeatureFlags()
  if (!flags.ssoEnabled || !flags.unifiedWebSessionEnabled) return true
  return !(await readsSignedInWebSession())
}

async function bootOnce(): Promise<void> {
  const auth = useAuthStore()
  if (auth.currentUser === null && (await storedApiKeyIsTheLogin())) return
  const webSession = useCloudWebSessionStore()
  if (!webSession.start()) return
  await webSession.whenReady()
  const sessionId = webSession.signedInUser?.id
  if (sessionId && auth.currentUser && auth.currentUser.uid !== sessionId) {
    await until(() => auth.currentUser === null).toBe(true, {
      timeout: DIFFERENT_LOGIN_SIGN_OUT_TIMEOUT_MS
    })
  }
}

/** Starts the web session once Firebase has restored, so it sees the remembered login. */
export function bootCloudIdentity(): Promise<void> {
  const webSession = useCloudWebSessionStore()
  const boot = boots.get(webSession) ?? bootOnce()
  boots.set(webSession, boot)
  return boot
}

export async function cloudSignIn(): Promise<CloudSignIn> {
  const auth = useAuthStore()
  const hasTokenLogin = async () => (await auth.getAuthHeader()) !== null
  await bootCloudIdentity()
  const webSession = useCloudWebSessionStore()
  await webSession.whenSessionCreated()
  if (!webSession.isActive()) {
    return (await hasTokenLogin()) ? 'signed_in' : 'signed_out'
  }
  const { state } = webSession
  if (state.phase === 'signed_in') return 'signed_in'
  if (state.phase === 'signed_out' && state.outcome === 'revoked') {
    return 'signed_out'
  }
  if (await hasTokenLogin()) return 'signed_in'
  return state.phase === 'retry_wait' ? 'pending' : 'signed_out'
}
