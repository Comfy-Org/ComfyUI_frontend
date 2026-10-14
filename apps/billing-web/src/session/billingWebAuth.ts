/**
 * The one place billing-web decides, once per page load, whether it runs on
 * its own Firebase sign-in or on the shared web session
 * (`unified_web_session`). Routing never waits for it: until it lands every
 * phase reads `pending`, which is what main shows while Firebase has not
 * answered. Nothing reads either side before then, so the web session path
 * never initialises Firebase it does not need. A probe that is absent or
 * false settles it at once; otherwise the credentialed read decides, bounded
 * by its own timeout. It is never cut short: falling back to this origin's
 * Firebase would sign in whoever last signed in here, not the Cloud session.
 */
import type { ComputedRef } from 'vue'
import { computed, shallowRef, watch } from 'vue'

import type { WebSessionMode } from '@comfyorg/account-core/billing'

import type { SignInPort } from '@/auth/useSignInController'
import { sessionClientPort } from '@/auth/useSignInController'
import { provideWebSessionCloudRead } from '@/config/checkoutUi'
import { CLOUD_BASE_URL } from '@/config/env'
import { resolveBillingWebIdentity } from '@/config/firebase'
import { readBillingWebUnifiedWebSession } from '@/config/unifiedWebSession'
import { bindEntryWorkspace, boundWorkspaceId } from '@/entry/workspaceBinding'
import type { BillingWebSessionPhase } from '@/router'
import type { BillingWebClient } from '@/session/billingWebClient'
import {
  createBillingWebClient,
  createWebSessionBillingClient
} from '@/session/billingWebClient'
import {
  billingWebSessionClient,
  billingWebSessionPhase,
  useBillingWebSession
} from '@/session/billingWebSession'
import type { UnifiedBillingSession } from '@/session/unifiedBillingSession'
import { createUnifiedBillingSession } from '@/session/unifiedBillingSession'
import {
  reportSessionEstablished,
  reportSessionFailed,
  reportSigninRequired
} from '@/telemetry/webSessionTelemetry'

interface BilledScope {
  readonly uid: string
  readonly workspace: { readonly id: string; readonly name: string }
}

const mode = shallowRef<WebSessionMode>()
let decision: Promise<WebSessionMode> | undefined
let unified: UnifiedBillingSession | undefined

function unifiedSession(): UnifiedBillingSession {
  unified ??= createUnifiedBillingSession({
    apiBaseUrl: `${CLOUD_BASE_URL}/api`,
    fetchImpl: (...args) => globalThis.fetch(...args),
    loadFirebase: resolveBillingWebIdentity,
    workspaceId: boundWorkspaceId
  })
  return unified
}

/** Set once the customer authenticates on this page, so a retry after that still reads as interactive. */
let signedInHere = false

function reportEstablished(decided: WebSessionMode): void {
  reportSessionEstablished(signedInHere ? 'interactive' : 'restored', decided)
}

function decideMode(): Promise<WebSessionMode> {
  decision ??= readBillingWebUnifiedWebSession().then((enabled) => {
    mode.value = enabled ? 'web-session' : 'session-client'
    return mode.value
  })
  return decision
}

/** The router guard's read; starts the decision and never waits for it. */
export function billingWebPhase():
  | BillingWebSessionPhase
  | Promise<BillingWebSessionPhase> {
  void decideMode()
  if (mode.value === 'web-session') return unifiedSession().settledPhase()
  return mode.value === 'session-client' ? billingWebSessionPhase() : 'pending'
}

/**
 * Rebinds the tab to a newly-arrived entry's workspace and, only when that
 * changes the binding, re-establishes the workspace right away, so nothing
 * meant for the new workspace is answered for the one this tab is leaving.
 * Before the mode is decided nothing is established yet, and whichever side
 * starts reads the binding live.
 */
export function onBillingWebEntryWorkspace(workspaceId: string): void {
  if (!bindEntryWorkspace(workspaceId) || mode.value === undefined) return
  if (mode.value === 'web-session') {
    void unifiedSession().resolveWorkspace()
    return
  }
  void billingWebSessionClient().ensureFresh(undefined, { workspaceId })
}

let sessionClient: ReturnType<typeof useBillingWebSession> | undefined

function sessionClientState(): ReturnType<typeof useBillingWebSession> {
  sessionClient ??= useBillingWebSession()
  return sessionClient
}

/** Undefined until the mode is decided; `App` keys the billing shell by it. */
export const billedScope = computed<BilledScope | undefined>(() => {
  if (mode.value === 'web-session') return unifiedSession().billedScope.value
  if (mode.value === undefined) return undefined
  return sessionClientState().session.value
})

/** The decided side's phase, for refusals that land after the page rendered. */
export const billingWebLivePhase = computed<BillingWebSessionPhase | undefined>(
  () => {
    if (mode.value === 'web-session') return unifiedSession().livePhase.value
    if (mode.value === undefined) return undefined
    return sessionClientState().phase.value
  }
)

/** For views inside the billing shell, which only mounts once decided. */
export function useBilledScope(): ComputedRef<BilledScope | undefined> {
  return mode.value === 'web-session'
    ? unifiedSession().billedScope
    : useBillingWebSession().session
}

let clientPort: SignInPort | undefined

function decidedPort(decided: WebSessionMode): SignInPort {
  if (decided === 'web-session') return unifiedSession().signInPort
  clientPort ??= sessionClientPort()
  return clientPort
}

/**
 * The sign-in page mounts before the decision lands; its port follows the
 * decision, so a Cloud session found in time leaves the page like a restore.
 * Opening the port is what puts the page in front of the customer, so it
 * reports that the session needs sign-in, and the port reports how each
 * attempt to establish the session went.
 */
export function billingWebSignInPort(): SignInPort {
  watch(billingWebLivePhase, reportSigninRequired, { immediate: true })
  return {
    user: computed(() =>
      mode.value ? decidedPort(mode.value).user.value : null
    ),
    failure: computed(() =>
      mode.value ? decidedPort(mode.value).failure.value : undefined
    ),
    loadIdentity: async () => decidedPort(await decideMode()).loadIdentity(),
    establish: async (user) => {
      const decided = await decideMode()
      if (user !== undefined) signedInHere = true
      const result = await decidedPort(decided).establish(user)
      if (result.status === 'ok') reportEstablished(decided)
      else reportSessionFailed(result.code)
      return result
    }
  }
}

provideWebSessionCloudRead(() => {
  if (mode.value !== 'web-session') return undefined
  const scope = unifiedSession().billedScope.value
  return (
    scope && {
      uid: scope.uid,
      read: (url, init) => unifiedSession().sessionGet(url, init)
    }
  )
})

export function createModeBillingClient(): BillingWebClient {
  return mode.value === 'web-session'
    ? createWebSessionBillingClient(unifiedSession())
    : createBillingWebClient(billingWebSessionClient())
}
