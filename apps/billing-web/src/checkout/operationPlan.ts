import type {
  BillingOperationPlan,
  BillingOperationState
} from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import type { LedgerContext } from '@/checkout/summaryLedger'

/**
 * A plan as the server reported it for an operation, for display. Each part is
 * absent while the server does not describe it: a tier it cannot name, or a
 * plan it could not price.
 */
export interface OperationPlanLabel {
  readonly name?: string
  readonly price?: string
  readonly period?: string
}

const CADENCE = {
  MONTHLY: 'checkout.fullPage.summary.cadence.monthly',
  ANNUAL: 'checkout.fullPage.summary.cadence.yearly'
} as const satisfies Record<BillingOperationPlan['duration'], string>

/** The plan the server reports for the operation: the pending one's, or the receipt of one that succeeded. */
export function operationPlanOf(
  operation: BillingOperationState | undefined
): BillingOperationPlan | undefined {
  if (operation?.phase === 'pending') return operation.plan
  if (operation?.phase === 'succeeded') return operation.receipt?.plan
  return undefined
}

/** One period's figure, except an annual plan, whose per-month figure the server gives on its own. */
function perMonthCents(plan: BillingOperationPlan) {
  return plan.duration === 'ANNUAL'
    ? plan.monthly_price_cents
    : plan.price_cents
}

export function operationPlanLabel(
  plan: BillingOperationPlan,
  { t, tierName, locale }: Pick<LedgerContext, 't' | 'tierName' | 'locale'>
): OperationPlanLabel | undefined {
  const name =
    plan.tier &&
    t('checkout.fullPage.summary.planWithCadence', {
      tier: tierName(plan.tier),
      cadence: t(CADENCE[plan.duration], {})
    })
  const cents = perMonthCents(plan)
  const priced =
    cents === undefined || plan.currency === undefined
      ? {}
      : {
          price: formatQuoteMoney(cents, plan.currency, locale),
          period: t('checkout.fullPage.ending.perMonth', {
            currency: plan.currency.toUpperCase()
          })
        }
  const label = { ...(name ? { name } : {}), ...priced }
  return Object.keys(label).length === 0 ? undefined : label
}
