/**
 * The one place billing-web decides, once per page load, whether it runs on
 * its own Firebase sign-in or on the shared web session
 * (`unified_web_session`). Routing never waits for it: until it lands every
 * phase reads `pending`, which is what main shows while Firebase has not
 * answered. Nothing reads either side before then, so the web session path
 * never initialises Firebase it does not need. A probe that is absent or
 * false settles it at once; the session path gets `DECISION_CAP_MS`, after
 * which this page load stays on the session client.
 */
import type { ComputedRef } from 'vue'
import { computed, shallowRef } from 'vue'

import type { BillingClient } from '@comfyorg/account-ui/billing'

import type { SignInPort } from '@/auth/useSignInController'
import { sessionClientPort } from '@/auth/useSignInController'
import { CLOUD_BASE_URL } from '@/config/env'
import { resolveBillingWebIdentity } from '@/config/firebase'
import { readBillingWebUnifiedWebSession } from '@/config/unifiedWebSession'
import { bindEntryWorkspace, boundWorkspaceId } from '@/entry/workspaceBinding'
import type { BillingWebSessionPhase } from '@/router'
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

type BillingWebMode = 'session-client' | 'web-session'

interface BilledScope {
  readonly uid: string
  readonly workspace: { readonly id: string; readonly name: string }
}

const mode = shallowRef<BillingWebMode>()
let decision: Promise<BillingWebMode> | undefined
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

const DECISION_CAP_MS = 800

/** First answer wins; a flag arriving after the cap changes nothing. */
function decideMode(): Promise<BillingWebMode> {
  decision ??= new Promise<boolean>((resolve) => {
    const cap = setTimeout(() => resolve(false), DECISION_CAP_MS)
    void readBillingWebUnifiedWebSession().then((enabled) => {
      clearTimeout(cap)
      resolve(enabled)
    })
  }).then((enabled) => {
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

function decidedPort(decided: BillingWebMode): SignInPort {
  if (decided === 'web-session') return unifiedSession().signInPort
  clientPort ??= sessionClientPort()
  return clientPort
}

/**
 * The sign-in page mounts before the decision lands; its port follows the
 * decision, so a Cloud session found in time leaves the page like a restore.
 */
export function billingWebSignInPort(): SignInPort {
  return {
    user: computed(() =>
      mode.value ? decidedPort(mode.value).user.value : null
    ),
    failureCode: computed(() =>
      mode.value ? decidedPort(mode.value).failureCode.value : undefined
    ),
    loadIdentity: async () => decidedPort(await decideMode()).loadIdentity(),
    establish: async (user) => decidedPort(await decideMode()).establish(user)
  }
}

export function createModeBillingClient(): BillingClient {
  return mode.value === 'web-session'
    ? createWebSessionBillingClient(unifiedSession())
    : createBillingWebClient(billingWebSessionClient())
}
