/**
 * The keep-subscription notice: a plan change on a plan set to end also
 * clears the cancel, and the server wants that consent spelled out. The
 * consent is about the renewal, not today's charge, so the body names the
 * renewal the quote reports and never a number computed here.
 */
import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

export interface KeepSubscriptionCopy {
  readonly title: string
  readonly body: string
}

export interface KeepSubscriptionContext {
  readonly tierName: (tier: SubscriptionPreview['new_plan']['tier']) => string
  readonly t: (key: string, named: Record<string, unknown>) => string
  readonly locale: string
}

type Change =
  | 'upgrade'
  | 'downgrade'
  | 'to_yearly'
  | 'to_monthly'
  | 'commitment'
  | 'other'

const K = 'checkout.fullPage.keepSubscription'

const CHANGE_OF_TRANSITION = {
  upgrade: 'upgrade',
  downgrade: 'downgrade',
  new_subscription: 'other'
} as const satisfies Record<
  Exclude<SubscriptionPreview['transition_type'], 'duration_change'>,
  Change
>

/** The renewal after a switch to yearly starts a new year, so its date is spelled out. */
function changeOf(quote: SubscriptionPreview): Change {
  const next = quote.new_plan
  if (next.tier === 'TEAM' && quote.current_plan?.tier === 'TEAM')
    return 'commitment'
  if (quote.transition_type !== 'duration_change')
    return CHANGE_OF_TRANSITION[quote.transition_type]
  return next.duration === 'ANNUAL' && quote.renewal_at !== undefined
    ? 'to_yearly'
    : 'to_monthly'
}

function longDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(iso))
}

export function keepSubscriptionCopy(
  quote: SubscriptionPreview,
  cancelAt: string | undefined,
  { tierName, t, locale }: KeepSubscriptionContext
): KeepSubscriptionCopy {
  const change = changeOf(quote)
  const amount = formatQuoteMoney(
    quote.renewal_amount_cents ?? quote.cost_next_period_cents,
    quote.currency ?? 'usd',
    locale
  )
  return {
    title:
      cancelAt === undefined
        ? t(`${K}.titleUndated`, {})
        : t(`${K}.title`, { date: longDate(cancelAt, locale) }),
    body: t(`${K}.body.${change}`, {
      amount,
      plan: t('checkout.fullPage.planName', {
        tier: tierName(quote.new_plan.tier)
      }),
      date:
        quote.renewal_at === undefined ? '' : longDate(quote.renewal_at, locale)
    })
  }
}
