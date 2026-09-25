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

import type { SignInPort } from '@/auth/useSignInController'
import { sessionClientPort } from '@/auth/useSignInController'
import { CLOUD_BASE_URL } from '@/config/env'
import { resolveBillingWebIdentity } from '@/config/firebase'
import { readBillingWebUnifiedWebSession } from '@/config/unifiedWebSession'
import { bindEntryWorkspace } from '@/entry/workspaceBinding'
import type { BillingWebSessionPhase } from '@/router'
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
    loadFirebase: resolveBillingWebIdentity
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
 * actually changes the binding on the session client, mints for it right
 * away — so a credential for the workspace this tab is leaving is never left
 * to answer a request meant for the new one. Before the mode is decided
 * nothing is minted yet, and whichever side starts reads the binding live.
 */
export function onBillingWebEntryWorkspace(workspaceId: string): void {
  if (!bindEntryWorkspace(workspaceId) || mode.value !== 'session-client') {
    return
  }
  void billingWebSessionClient().ensureFresh(undefined, { workspaceId })
}

let sessionClientScope: ComputedRef<BilledScope | undefined> | undefined

/** Undefined until the mode is decided; `App` keys the billing shell by it. */
export const billedScope = computed<BilledScope | undefined>(() => {
  if (mode.value !== 'session-client') return undefined
  sessionClientScope ??= useBillingWebSession().session
  return sessionClientScope.value
})

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
