import { useEventListener } from '@vueuse/core'
import { computed, onScopeDispose, readonly, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import { discoverSso, ssoStartUrl } from '@comfyorg/account-core/sso'
import type { SsoSurface } from '@comfyorg/account-core/telemetry'

import { toSsoReturnPath } from '@/platform/auth/sso/ssoReturnPath'
import {
  trackSsoContinueClicked,
  trackSsoSignInFailed
} from '@/platform/auth/sso/ssoTelemetry'

import {
  captureOAuthRequestId,
  getOAuthRequestId
} from '@/platform/cloud/oauth/oauthState'
import type {
  SsoSignInEvent,
  SsoSignInState
} from '@/platform/cloud/onboarding/sso/ssoSignInState'
import {
  isSsoBusy,
  reduceSsoSignIn
} from '@/platform/cloud/onboarding/sso/ssoSignInState'
import { getSafePreviousFullPath } from '@/platform/cloud/onboarding/utils/previousFullPath'

const SSO_DEFAULT_RETURN_TO = '/cloud/user-check'

/**
 * Where SSO lands the person. A pending OAuth consent outranks
 * previousFullPath, as it does after a Firebase sign-in. The callback sets the
 * session cookie that the consent challenge is authenticated by, so it can land
 * on the consent page directly.
 */
export function resolveSsoReturnTo(
  route: RouteLocationNormalizedLoaded,
  router: Router
): string {
  const oauthRequestId =
    captureOAuthRequestId(route.query) ?? getOAuthRequestId()
  if (oauthRequestId) {
    return toSsoReturnPath(
      router.resolve({
        name: 'cloud-oauth-consent',
        query: { oauth_request_id: oauthRequestId }
      }).href
    )
  }
  return getSafePreviousFullPath(route.query) ?? SSO_DEFAULT_RETURN_TO
}

/** SSO sign-in for the cloud auth pages, where ingest is same-origin. */
export function useSsoSignIn(surface: SsoSurface) {
  const route = useRoute()
  const router = useRouter()
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
    if (!event.persisted) return
    if (state.value.phase === 'redirecting') {
      trackSsoSignInFailed('cancelled', surface)
    }
    dispatch({ type: 'restored' })
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
    trackSsoContinueClicked(surface)
    window.location.assign(
      ssoStartUrl({
        email,
        returnTo: resolveSsoReturnTo(route, router),
        origin: window.location.origin
      })
    )
    return true
  }

  return { state: readonly(state), busy, trySso }
}
