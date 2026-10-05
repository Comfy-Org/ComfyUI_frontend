import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, readonly, ref } from 'vue'
import { useRoute } from 'vue-router'

import { discoverSso, ssoStartUrl } from '@comfyorg/account-core/sso'

import type {
  SsoSignInEvent,
  SsoSignInState
} from '@/platform/cloud/onboarding/sso/ssoSignInState'
import {
  isSsoBusy,
  reduceSsoSignIn
} from '@/platform/cloud/onboarding/sso/ssoSignInState'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'

const DEFAULT_RETURN_TO = '/cloud/user-check'

/** SSO sign-in for the cloud auth pages, where ingest is same-origin. */
export function useSsoSignIn() {
  const route = useRoute()
  const state = ref<SsoSignInState>({ phase: 'idle' })
  const dispatch = (event: SsoSignInEvent) => {
    state.value = reduceSsoSignIn(state.value, event)
  }
  const busy = computed(() => isSsoBusy(state.value))

  const disposal = new AbortController()
  onScopeDispose(() => disposal.abort())

  // Back from the identity provider restores this page from the bfcache with
  // the navigation it started still showing as in flight.
  useEventListener(window, 'pageshow', (event) => {
    if (event.persisted) dispatch({ type: 'restored' })
  })

  /**
   * Sends an SSO email to its identity provider. True when SSO owns the
   * sign-in from here (a redirect, or a check already in flight); false means
   * the caller carries on with its own sign-in.
   */
  async function trySso(email: string): Promise<boolean> {
    if (busy.value) return true
    dispatch({ type: 'submitted' })
    const discovery = await discoverSso(email, {
      fetchImpl: (input, init) => fetch(input, init),
      signal: disposal.signal
    })
    if (disposal.signal.aborted) return true
    dispatch({ type: 'discovered', discovery })
    if (discovery.kind !== 'sso') return false
    window.location.assign(
      ssoStartUrl({
        email,
        returnTo: getSafePreviousFullPath(route.query) ?? DEFAULT_RETURN_TO,
        origin: window.location.origin
      })
    )
    return true
  }

  return { state: readonly(state), busy, trySso }
}
