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

function armReturnRefresh(): void {
  stopReturnRefresh?.()
  // Resolved inside the call, not at module scope: useBillingContext ->
  // useWorkspaceBilling -> this module would otherwise dereference the
  // shared context before its state is constructed.
  const { fetchStatus, fetchBalance } = useBillingContext()
  stopReturnRefresh = registerRefreshOnReturn(() =>
    Promise.allSettled([
      fetchStatus(),
      fetchBalance(),
      useBillingCapabilities().refresh()
    ])
  )
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
  armReturnRefresh()
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
