import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { endingOf } from '@/checkout/endingScreen'
import type {
  DiscountRow,
  LedgerContext,
  SummaryLedger
} from '@/checkout/summaryLedger'
import { buildSummaryLedger } from '@/checkout/summaryLedger'

/**
 * Why a Success card's charge differs from the plan rate it shows: one row
 * per reason the server reported, then what it charged today.
 */
export interface SuccessBreakdown {
  readonly deductions: readonly DiscountRow[]
  readonly paidToday: SummaryLedger['items'][number]
}

/**
 * What the page knows about the charge. This page's own Pay still holds the
 * quote it paid, so its reasons are the quote's; a return from a payment
 * provider knows only what the operation status reports.
 */
type ChargeSource =
  | {
      readonly kind: 'quoted'
      readonly quote: SubscriptionPreview
      readonly paidCents: number
    }
  | {
      readonly kind: 'op_status'
      readonly rateCents: number
      readonly paidCents: number
    }

type Terminal = Extract<CheckoutPage, { kind: 'terminal' }>

function chargedCents({ operation }: Terminal): number | undefined {
  return operation?.phase === 'succeeded'
    ? operation.receipt?.amountChargedCents
    : undefined
}

function quotedSource(
  quote: SubscriptionPreview | undefined,
  charged: number | undefined
): ChargeSource | undefined {
  if (quote === undefined) return undefined
  return {
    kind: 'quoted',
    quote,
    paidCents: charged ?? quote.amount_due_cents ?? quote.cost_today_cents
  }
}

function opStatusSource(
  plan: Terminal['plan'],
  charged: number | undefined
): ChargeSource | undefined {
  if (plan === undefined || charged === undefined) return undefined
  return {
    kind: 'op_status',
    rateCents: Number(plan.price_cents),
    paidCents: charged
  }
}

function chargeSourceOf(
  page: CheckoutPage,
  quote: SubscriptionPreview | undefined
): ChargeSource | undefined {
  if (page.kind !== 'terminal' || endingOf(page)?.kind !== 'success')
    return undefined
  const charged = chargedCents(page)
  return page.attribution === 'started'
    ? quotedSource(quote, charged)
    : opStatusSource(page.plan, charged)
}

const R = 'checkout.fullPage.ending.receipt'

/**
 * The rows under a Success card's plan rate, or none while today's charge
 * equals that rate. "Differs" compares the two server amounts; no reason's
 * amount is derived from the gap. A plan-level rate is already the card's
 * price, and a scheduled change charges nothing today, so neither gets rows.
 * Proration is not itemized, only named under the amount paid.
 */
export function successBreakdown(
  page: CheckoutPage,
  quote: SubscriptionPreview | undefined,
  context: LedgerContext
): SuccessBreakdown | undefined {
  const source = chargeSourceOf(page, quote)
  if (source === undefined) return undefined
  const { t, locale } = context

  if (source.kind === 'op_status')
    return source.paidCents === source.rateCents
      ? undefined
      : {
          deductions: [],
          paidToday: {
            label: t(`${R}.paidToday`, {}),
            amount: formatQuoteMoney(source.paidCents, 'usd', locale),
            sublines: []
          }
        }

  const { quote: paid, paidCents } = source
  if (paidCents === paid.new_plan.price_cents) return undefined
  const ledger = buildSummaryLedger(paid, context)
  const paidToday = {
    label: t(`${R}.paidToday`, {}),
    amount: formatQuoteMoney(paidCents, paid.currency ?? 'usd', locale)
  }
  switch (ledger.family) {
    case 'scheduled':
      return undefined
    case 'prorated_change':
      return {
        deductions: [],
        paidToday: { ...paidToday, sublines: [t(`${R}.prorated`, {})] }
      }
    default:
      return {
        deductions:
          ledger.balance === undefined
            ? ledger.discounts
            : [...ledger.discounts, ledger.balance],
        paidToday: { ...paidToday, sublines: [] }
      }
  }
}
