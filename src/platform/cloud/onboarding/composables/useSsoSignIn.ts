import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  discoverSso,
  readSsoError,
  ssoStartUrl
} from '@comfyorg/account-core/sso'

import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'

export type SsoEntryState =
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

  const discover = (email: string) =>
    discoverSso(email, { fetchImpl: (input, init) => fetch(input, init) })

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
    if (result.kind === 'sso') return startSso(email)
    state.value = { phase: result.kind }
  }

  /** Sends an SSO email to its IdP; any other answer, or none, falls through. */
  async function redirectIfSso(email: string): Promise<boolean> {
    const result = await discover(email)
    if (result.kind !== 'sso') return false
    startSso(email)
    return true
  }

  return { state, ssoError, busy, continueWithSso, redirectIfSso }
}
