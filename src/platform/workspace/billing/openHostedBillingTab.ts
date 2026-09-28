/**
 * The one place that opens a hosted billing tab. Every entry point — the
 * avatar menu's Plans and pricing, the workspace settings' Billing &
 * invoices, and a future in-app subscribe CTA — routes through here so the
 * workspace the host is showing is always the one billing-web operates on,
 * and a return to the app always refreshes the same state.
 */
import type { BillingIntent } from '@comfyorg/billing-contract'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { hostedBillingRoute } from '@/platform/workspace/billing/hostedBillingRoutes'
import { registerRefreshOnReturn } from '@/platform/workspace/billing/refreshOnReturn'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface OpenHostedBillingTabOptions {
  readonly plan?: string
  readonly teamCreditStopId?: string
}

/**
 * `noopener` returns a null handle even on success, so the blocked tab and the
 * opened one are told apart by opening a blank tab and clearing `opener` by
 * hand before it leaves `about:blank`. Only that one property survives: the
 * tab stays in this page's browsing-context group and sends this origin as
 * the referrer, both of which `'noopener,noreferrer'` would have prevented.
 */
function openDisownedTab(url: URL): boolean {
  const tab = window.open('', '_blank')
  if (!tab) return false
  tab.opener = null
  tab.location.href = url.href
  return true
}

let stopReturnRefresh: (() => void) | null = null
let stopOperationWatch: (() => void) | null = null

export function disarmHostedBillingReturnRefresh(): void {
  stopReturnRefresh?.()
  stopReturnRefresh = null
  stopOperationWatch?.()
  stopOperationWatch = null
}

const OPERATION_INTENTS: ReadonlySet<BillingIntent> = new Set([
  'checkout',
  'subscription'
])
const OPERATION_POLL_MS = 4_000
const OPERATION_WATCH_MS = 15 * 60_000

/**
 * A payment billing-web takes never pushes back to this tab, but each status
 * read resumes the operation the server reports pending, which shows the same
 * progress and outcome toasts the embedded checkout shows. Reading it while
 * the hosted tab is open is what lets this tab show them too. A read still in
 * flight skips the tick, and a failed read waits for the next one.
 */
function watchForHostedOperation(readStatus: () => Promise<unknown>) {
  const startedAt = Date.now()
  let reading = false
  const timer = setInterval(() => {
    if (Date.now() - startedAt >= OPERATION_WATCH_MS) {
      clearInterval(timer)
      return
    }
    if (reading) return
    reading = true
    void readStatus()
      .catch(() => undefined)
      .finally(() => {
        reading = false
      })
  }, OPERATION_POLL_MS)
  return () => clearInterval(timer)
}

function armReturnRefresh(intent: BillingIntent): void {
  disarmHostedBillingReturnRefresh()
  // Resolved inside the call, not at module scope: useBillingContext ->
  // useWorkspaceBilling -> this module would otherwise dereference the
  // shared context before its state is constructed.
  const { fetchStatus, fetchBalance, reconcileSubscriptionSuccess } =
    useBillingContext()
  stopReturnRefresh = registerRefreshOnReturn(() =>
    Promise.allSettled([
      fetchStatus(),
      fetchBalance(),
      useBillingCapabilities().refresh()
    ])
  )
  if (OPERATION_INTENTS.has(intent)) {
    stopOperationWatch = watchForHostedOperation(reconcileSubscriptionSuccess)
  }
}

export type HostedBillingTabOutcome = 'opened' | 'unavailable' | 'blocked'

/**
 * Opens `intent` in a hosted billing tab carrying the active workspace, and
 * arms the same-state refresh for when the customer comes back. Reports
 * `unavailable` when the destination isn't billing_web and `blocked` when the
 * browser refused the tab.
 */
export function openHostedBillingTabOutcome(
  intent: BillingIntent,
  options: OpenHostedBillingTabOptions = {}
): HostedBillingTabOutcome {
  const { flags } = useFeatureFlags()
  const workspaceId = useTeamWorkspaceStore().activeWorkspaceId ?? undefined
  const route = hostedBillingRoute(flags.hostedBillingDestination, intent, {
    plan: options.plan,
    teamCreditStopId: options.teamCreditStopId,
    workspaceId
  })
  if (route.kind !== 'billing_web') return 'unavailable'
  if (!openDisownedTab(route.url)) return 'blocked'
  armReturnRefresh(intent)
  return 'opened'
}

/**
 * {@link openHostedBillingTabOutcome} for callers whose fallback is the same
 * whether the destination isn't billing_web or the tab was blocked.
 */
export function openHostedBillingTab(
  intent: BillingIntent,
  options: OpenHostedBillingTabOptions = {}
): boolean {
  return openHostedBillingTabOutcome(intent, options) === 'opened'
}
