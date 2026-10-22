import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

export type CheckoutBillingCycle = 'monthly' | 'yearly'

/**
 * The plan being bought, as the host resolved it (tier copy or a team credit
 * stop). The checkout surfaces format and lay it out; they never consult a
 * catalog.
 */
export interface CheckoutPlan {
  readonly name: string
  /** Per-month price billed monthly, and per-month price billed yearly. */
  readonly monthlyPriceUsd: {
    readonly monthly: number
    readonly yearly: number
  }
  readonly monthlyCredits: number
  /**
   * A tier plan shows the quote's price once one arrives; a team credit stop
   * always shows its own.
   */
  readonly pricedByQuote: boolean
}

type PlanDuration = SubscriptionPreview['new_plan']['duration']

export function isAnnualDuration(duration: PlanDuration | undefined): boolean {
  return duration === 'ANNUAL'
}

/**
 * The preview's resolved plan duration wins; absent a preview (fresh subscribe
 * with no proration) it falls back to the user's selected billing cycle.
 */
export function isYearlyCheckout(
  planDuration: PlanDuration | undefined,
  billingCycle: CheckoutBillingCycle
): boolean {
  return planDuration !== undefined
    ? isAnnualDuration(planDuration)
    : billingCycle === 'yearly'
}

// Legacy previews price in USD and carry no currency field.
const LEGACY_QUOTE_CURRENCY = 'usd'

export function formatQuoteMoney(
  cents: number,
  currency: string | undefined,
  locale: string
): string {
  if (!currency) return ''
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(cents / 100)
}

/** Locale-grouped number, as the host's i18n `n()` prints one. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

/** Two-decimal display without a currency symbol; the template adds `$`. */
export function formatUsdFromCents(cents: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100)
}

interface QuoteMoney {
  cents: number
  currency: string | undefined
}

function resolveQuoteMoney(
  exactCents: number | undefined,
  exactCurrency: string | undefined,
  legacyCents: number
): QuoteMoney {
  return exactCents === undefined
    ? { cents: legacyCents, currency: LEGACY_QUOTE_CURRENCY }
    : { cents: exactCents, currency: exactCurrency }
}

function resolveAmountDueToday(preview: SubscriptionPreview): QuoteMoney {
  return resolveQuoteMoney(
    preview.amount_due_cents,
    preview.currency,
    preview.cost_today_cents
  )
}

export function amountDueTodayChanged(
  installed: SubscriptionPreview,
  refreshed: SubscriptionPreview
): boolean {
  const before = resolveAmountDueToday(installed)
  const after = resolveAmountDueToday(refreshed)
  return before.cents !== after.cents || before.currency !== after.currency
}

export function formatAmountDueToday(
  preview: SubscriptionPreview,
  locale: string
): string {
  const { cents, currency } = resolveAmountDueToday(preview)
  return formatQuoteMoney(cents, currency, locale)
}

export function formatRenewalAmount(
  preview: SubscriptionPreview,
  locale: string
): string {
  const { cents, currency } = resolveQuoteMoney(
    preview.renewal_amount_cents,
    preview.currency,
    preview.cost_next_period_cents
  )
  return formatQuoteMoney(cents, currency, locale)
}

export function resolveRenewalDate(
  preview: SubscriptionPreview
): string | undefined {
  return preview.renewal_at ?? preview.new_plan.period_end
}
