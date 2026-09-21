import type { PreviewSubscribeResponse } from '@comfyorg/ingest-types'

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

function resolveAmountDueToday(preview: PreviewSubscribeResponse): QuoteMoney {
  return resolveQuoteMoney(
    preview.amount_due_cents,
    preview.currency,
    preview.cost_today_cents
  )
}

export function amountDueTodayChanged(
  installed: PreviewSubscribeResponse,
  refreshed: PreviewSubscribeResponse
): boolean {
  const before = resolveAmountDueToday(installed)
  const after = resolveAmountDueToday(refreshed)
  return before.cents !== after.cents || before.currency !== after.currency
}

export function formatAmountDueToday(
  preview: PreviewSubscribeResponse,
  locale: string
): string {
  const { cents, currency } = resolveAmountDueToday(preview)
  return formatQuoteMoney(cents, currency, locale)
}

export function formatRenewalAmount(
  preview: PreviewSubscribeResponse,
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
  preview: PreviewSubscribeResponse
): string | undefined {
  return preview.renewal_at ?? preview.new_plan.period_end
}
