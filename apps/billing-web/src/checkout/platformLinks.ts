import type { BillingEntry } from '@comfyorg/billing-contract'

import { PLATFORM_BASE_URL } from '@/config/env'

type PlansArrival = Pick<BillingEntry, 'teamCreditStopId' | 'correlationId'>

function platformLink(
  path: `/${string}`,
  params: Readonly<Record<string, string | undefined>>
): string {
  const url = new URL(path, PLATFORM_BASE_URL)
  for (const [name, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(name, value)
  return url.href
}

/** Platform's Plans page in the billed workspace, on the Team tab and stop when the link asked for a team plan. */
export function platformPlansUrl(
  arrival: PlansArrival | undefined,
  workspaceId: string | undefined,
  asksTeam = arrival?.teamCreditStopId !== undefined
): string {
  return platformLink('/settings/billing/plans', {
    pricing: asksTeam ? 'team' : undefined,
    stop: asksTeam ? arrival?.teamCreditStopId : undefined,
    correlation_id: arrival?.correlationId,
    workspace: workspaceId
  })
}

/** Platform's Billing page in the billed workspace. */
export function platformBillingUrl(workspaceId: string | undefined): string {
  return platformLink('/settings/billing', { workspace: workspaceId })
}
