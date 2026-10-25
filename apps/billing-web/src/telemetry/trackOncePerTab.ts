import type { BillingTelemetryEvent } from '@comfyorg/account-core/billing'
import { getBillingTelemetryEventName } from '@comfyorg/account-core/billing'

import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

const STORAGE_KEY = 'comfy.billing-web.reported-events.v1'

const reportedWithoutStorage = new Set<string>()

/**
 * sessionStorage outlives a reload and ends with the tab, which is the span
 * of one tab entry. A tab that refuses storage still reports once per page.
 */
function claimReport(name: string): boolean {
  try {
    const reported = sessionStorage.getItem(STORAGE_KEY)?.split(',') ?? []
    if (reported.includes(name)) return false
    sessionStorage.setItem(STORAGE_KEY, [...reported, name].join(','))
    return true
  } catch {
    if (reportedWithoutStorage.has(name)) return false
    reportedWithoutStorage.add(name)
    return true
  }
}

/**
 * Reports an event the first time this tab produces it, whatever it navigates
 * through after. An `occurrence` makes each of its values count on its own.
 */
export function trackOncePerTab(
  event: BillingTelemetryEvent,
  occurrence?: string
): void {
  const name = getBillingTelemetryEventName(event)
  if (claimReport(occurrence === undefined ? name : `${name}:${occurrence}`)) {
    billingWebTelemetry.trackBillingEvent(event)
  }
}
