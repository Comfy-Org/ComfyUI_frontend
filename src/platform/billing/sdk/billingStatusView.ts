import type { BillingStatusData } from '@comfyorg/account-core/billing'

import type {
  BillingStatusResponse,
  RenewalInvoice,
  TeamCreditStopSummary
} from '@comfyorg/billing-core'

import { asSafeNumber } from './safeInt64'

type DecodedCreditStop = NonNullable<BillingStatusData['team_credit_stop']>
type DecodedRenewalInvoice = NonNullable<BillingStatusData['renewal_invoice']>
type DecodedPeriodCreditGrant = NonNullable<
  BillingStatusData['period_credit_grant']
>
type PeriodCreditGrant = NonNullable<
  BillingStatusResponse['period_credit_grant']
>

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

function projectPeriodCreditGrant({
  credits: rawCredits,
  ...grant
}: DecodedPeriodCreditGrant): PeriodCreditGrant | undefined {
  if (rawCredits === undefined) return grant
  const credits = asSafeNumber(rawCredits)
  return credits === undefined ? undefined : { ...grant, credits }
}

/**
 * The SDK's decoded status in the shape the host's billing state holds, or
 * undefined when a value in it cannot be held exactly — a read the caller
 * reports as malformed rather than publishes rounded.
 */
export function projectBillingStatus(
  status: BillingStatusData
): BillingStatusResponse | undefined {
  const {
    team_credit_stop,
    scheduled_change,
    renewal_invoice,
    period_credit_grant,
    ...rest
  } = status
  const stop =
    team_credit_stop === null ? null : projectCreditStop(team_credit_stop)
  if (stop === undefined) return undefined
  const scheduledStop =
    scheduled_change === null || scheduled_change.team_credit_stop === null
      ? null
      : projectCreditStop(scheduled_change.team_credit_stop)
  if (scheduledStop === undefined) return undefined
  const invoice =
    renewal_invoice === undefined
      ? undefined
      : projectRenewalInvoice(renewal_invoice)
  const grant =
    period_credit_grant === undefined
      ? undefined
      : projectPeriodCreditGrant(period_credit_grant)
  return {
    ...rest,
    ...(invoice && { renewal_invoice: invoice }),
    ...(grant && { period_credit_grant: grant }),
    team_credit_stop: stop,
    scheduled_change:
      scheduled_change === null
        ? null
        : { ...scheduled_change, team_credit_stop: scheduledStop }
  }
}
