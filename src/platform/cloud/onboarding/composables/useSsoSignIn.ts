import { computed, onScopeDispose, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  discoverSso,
  readSsoError,
  ssoStartUrl
} from '@comfyorg/account-core/sso'

import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'

type SsoEntryState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'redirecting' }
  | { phase: 'not-sso' }
  | { phase: 'invalid-email' }
  | { phase: 'unavailable' }

const DEFAULT_RETURN_TO = '/cloud/user-check'

/** Email-first SSO for the cloud auth pages; ingest is same-origin here. */
export function useSsoSignIn() {
  const route = useRoute()
  const state = ref<SsoEntryState>({ phase: 'idle' })
  const ssoError = computed(() => readSsoError(route.query.sso_error))
  const busy = computed(
    () =>
      state.value.phase === 'checking' || state.value.phase === 'redirecting'
  )

  const disposal = new AbortController()
  onScopeDispose(() => disposal.abort())

  const discover = (email: string) =>
    discoverSso(email, {
      fetchImpl: (input, init) => fetch(input, init),
      signal: disposal.signal
    })

  function startSso(email: string) {
    state.value = { phase: 'redirecting' }
    window.location.assign(
      ssoStartUrl({
        email,
        returnTo: getSafePreviousFullPath(route.query),
        origin: window.location.origin,
        fallbackReturnTo: DEFAULT_RETURN_TO
      })
    )
  }

  async function continueWithSso(email: string): Promise<void> {
    if (busy.value) return
    state.value = { phase: 'checking' }
    const result = await discover(email)
    if (disposal.signal.aborted) return
    if (result.kind === 'sso') return startSso(email)
    state.value = { phase: result.kind }
  }

  /**
   * Sends an SSO email to its IdP. False means the caller continues its usual
   * sign-in; a repeat click or a page left mid-discover answers true.
   */
  async function redirectIfSso(email: string): Promise<boolean> {
    if (busy.value) return true
    state.value = { phase: 'checking' }
    const result = await discover(email)
    if (disposal.signal.aborted) return true
    if (result.kind === 'sso') {
      startSso(email)
      return true
    }
    state.value = { phase: 'idle' }
    return false
  }

  return { state, ssoError, busy, continueWithSso, redirectIfSso }
}
