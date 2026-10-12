import type { BillingStatusData } from '@comfyorg/account-core/billing'

import type {
  BillingStatusResponse,
  RenewalInvoice,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'

import { asSafeNumber } from './safeInt64'

type DecodedCreditStop = NonNullable<BillingStatusData['team_credit_stop']>
type DecodedRenewalInvoice = NonNullable<BillingStatusData['renewal_invoice']>

/**
 * The credit stop's two int64 fields — a monthly credit count and a monthly
 * USD commitment — read back as the numbers the host holds; undefined when
 * either is past what a number can hold exactly.
 */
function projectCreditStop(
  stop: DecodedCreditStop
): TeamCreditStopSummary | undefined {
  const credits_monthly = asSafeNumber(stop.credits_monthly)
  const stop_usd = asSafeNumber(stop.stop_usd)
  if (credits_monthly === undefined || stop_usd === undefined) return undefined
  return { id: stop.id, credits_monthly, stop_usd }
}

function projectRenewalInvoice(
  invoice: DecodedRenewalInvoice
): RenewalInvoice | undefined {
  const amount_due = asSafeNumber(invoice.amount_due)
  if (amount_due === undefined) return undefined
  return { ...invoice, amount_due }
}

/**
 * The SDK's decoded status in the shape the host's billing state holds, or
 * undefined when a value in it cannot be held exactly — a read the caller
 * reports as malformed rather than publishes rounded.
 */
export function projectBillingStatus(
  status: BillingStatusData
): BillingStatusResponse | undefined {
  const { team_credit_stop, scheduled_change, renewal_invoice, ...rest } =
    status
  const stop =
    team_credit_stop === null ? null : projectCreditStop(team_credit_stop)
  if (stop === undefined) return undefined
  const scheduledStop =
    scheduled_change === null || scheduled_change.team_credit_stop === null
      ? null
      : projectCreditStop(scheduled_change.team_credit_stop)
  if (scheduledStop === undefined) return undefined
  // An unreadable invoice amount drops only the invoice, not the whole status.
  const invoice =
    renewal_invoice === undefined
      ? undefined
      : projectRenewalInvoice(renewal_invoice)
  return {
    ...rest,
    ...(invoice && { renewal_invoice: invoice }),
    team_credit_stop: stop,
    scheduled_change:
      scheduled_change === null
        ? null
        : { ...scheduled_change, team_credit_stop: scheduledStop }
  }
}
