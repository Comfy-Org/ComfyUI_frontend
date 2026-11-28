import type { BillingChargeReason } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { endingOf } from '@/checkout/endingScreen'
import type {
  DeductionFormat,
  DiscountRow,
  LedgerContext,
  SummaryLedger
} from '@/checkout/summaryLedger'
import { balanceRow, discountRow } from '@/checkout/summaryLedger'

/**
 * Why a Success card's charge differs from the plan rate it shows: one row
 * per reason the server reported, then what it charged today.
 */
export interface SuccessBreakdown {
  readonly deductions: readonly DiscountRow[]
  readonly paidToday: SummaryLedger['items'][number]
}

const R = 'checkout.fullPage.ending.receipt'

const REASON_ROW = {
  account_balance: (format, reason) => balanceRow(format, reason.amount_cents),
  promo_code: (format, reason) =>
    discountRow(format, reason.discount ?? {}, reason.amount_cents),
  subscription_discount: (format, reason) =>
    discountRow(format, reason.discount ?? {}, reason.amount_cents)
} satisfies Record<
  BillingChargeReason['kind'],
  (format: DeductionFormat, reason: BillingChargeReason) => DiscountRow
>

/**
 * The rows under a Success card's plan rate, exactly as the operation status
 * reports them; absent while the server reports no breakdown. Proration is
 * not itemized, only named under the amount paid.
 */
export function successBreakdown(
  page: CheckoutPage,
  { t, locale }: Pick<LedgerContext, 't' | 'locale'>
): SuccessBreakdown | undefined {
  if (page.kind !== 'terminal' || endingOf(page)?.kind !== 'success')
    return undefined
  const operation = page.operation
  if (operation?.phase !== 'succeeded') return undefined
  const breakdown = operation.receipt?.chargeBreakdown
  if (breakdown === undefined) return undefined

  const format: DeductionFormat = {
    t,
    money: (cents) => formatQuoteMoney(cents, breakdown.currency, locale)
  }
  return {
    deductions: breakdown.reasons.map((reason) =>
      REASON_ROW[reason.kind](format, reason)
    ),
    paidToday: {
      label: t(`${R}.paidToday`, {}),
      amount: format.money(breakdown.amount_charged_cents),
      sublines: breakdown.prorated ? [t(`${R}.prorated`, {})] : []
    }
  }
}
