import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

/**
 * The four summary families of the checkout guidebook. `top_up`
 * has no quote on billing-web yet, so no builder produces it.
 */
type SummaryFamily = 'charge_now' | 'prorated_change' | 'scheduled' | 'top_up'

/** A ledger line: a label and its sublines on the left, dollars on the right. */
interface LedgerRow {
  readonly label: string
  readonly amount: string
  readonly sublines: readonly string[]
}

/**
 * The customer's commitment, as the column renders it. Money rows sit in the
 * ledger and resolve into `total`; future events are plain lines that only
 * ever render under the total, so a date can never land in the dollar column.
 */
export interface SummaryLedger {
  readonly family: SummaryFamily
  readonly eyebrow: string
  readonly headline: {
    readonly amount: string
    readonly currency: string
    readonly rate?: string
  }
  readonly credits?: { readonly count: string; readonly qualifier: string }
  readonly items: readonly [LedgerRow, ...LedgerRow[]]
  /** Promo rows; strikethrough is reserved for these. */
  readonly adjustments: readonly LedgerRow[]
  readonly subtotal?: string
  readonly total: string
  readonly trailing: readonly string[]
}

type Translate = (key: string, named: Record<string, unknown>) => string
type Duration = SubscriptionPreview['new_plan']['duration']
type Plan = SubscriptionPreview['new_plan']

export interface LedgerContext {
  /** The billed workspace from the session, never from the quote. */
  readonly workspace: string | undefined
  readonly tierName: (tier: Plan['tier']) => string
  readonly t: Translate
  readonly locale: string
}

const S = 'checkout.fullPage.summary'

const BY_DURATION = {
  MONTHLY: {
    cadence: `${S}.cadence.monthly`,
    rate: `${S}.rate.monthly`,
    itemRate: `${S}.item.rateMonthly`,
    perPeriod: `${S}.credits.perMonth`,
    refillAfter: `${S}.credits.refillMonthlyAfter`,
    refillsTo: `${S}.item.refillsMonthly`,
    startsOn: `${S}.item.startsMonthly`
  },
  ANNUAL: {
    cadence: `${S}.cadence.yearly`,
    rate: `${S}.rate.yearly`,
    itemRate: `${S}.item.rateYearly`,
    perPeriod: `${S}.credits.perYear`,
    refillAfter: `${S}.credits.refillYearlyAfter`,
    refillsTo: `${S}.item.refillsYearly`,
    startsOn: `${S}.item.startsYearly`
  }
} as const satisfies Record<Duration, Record<string, string>>

/** Drops `.00` from whole amounts and keeps real cents: $700, $32.50. */
export function formatHeadlineMoney(
  cents: number,
  currency: string,
  locale: string
): string {
  const digits = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(cents / 100)
}

function verbOf(quote: SubscriptionPreview, commitChange: boolean) {
  if (quote.transition_type === 'new_subscription') return 'subscribe'
  if (quote.transition_type !== 'upgrade') return 'switch'
  return commitChange ? 'change' : 'upgrade'
}

function planLabeller({ t, tierName }: LedgerContext) {
  return (plan: Plan, cadenceShown: boolean) =>
    cadenceShown
      ? t(`${S}.planWithCadence`, {
          tier: tierName(plan.tier),
          cadence: t(BY_DURATION[plan.duration].cadence, {})
        })
      : t('checkout.fullPage.planName', { tier: tierName(plan.tier) })
}

function eyebrowOf(action: string, { t, workspace }: LedgerContext) {
  return workspace === undefined
    ? action
    : t(`${S}.scoped`, { action, workspace })
}

/** The quote's facts and formatters every family reads from. */
function readQuote(quote: SubscriptionPreview, context: LedgerContext) {
  const { t, tierName, locale } = context
  const currency = quote.currency ?? 'usd'
  const next = quote.new_plan
  const current = quote.current_plan
  const commitChange = next.tier === 'TEAM' && current?.tier === 'TEAM'
  const cadenceChanges =
    current !== undefined && current.duration !== next.duration
  const money = (cents: number) => formatQuoteMoney(cents, currency, locale)
  const planLabel = planLabeller(context)
  const plan = planLabel(next, cadenceChanges)
  const action = t(`${S}.verb.${verbOf(quote, commitChange)}`, { plan })
  const dueCents = quote.amount_due_cents ?? quote.cost_today_cents

  return {
    quote,
    t,
    tierName,
    next,
    current,
    commitChange,
    cadenceChanges,
    byNew: BY_DURATION[next.duration],
    plan,
    planLabel,
    money,
    date: (iso: string) =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(iso)),
    /** Month and day only: a credits expiry always falls within the current period. */
    monthDay: (iso: string) =>
      new Intl.DateTimeFormat(locale, {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(iso)),
    headlineMoney: (cents: number) =>
      formatHeadlineMoney(cents, currency, locale),
    credits: (cents: number) =>
      new Intl.NumberFormat(locale).format(centsToCredits(cents)),
    currency: currency.toUpperCase(),
    dueCents,
    recurringCents: quote.renewal_amount_cents ?? quote.cost_next_period_cents,
    shared: {
      eyebrow: eyebrowOf(action, context),
      adjustments: [],
      total: money(dueCents)
    }
  } as const
}

type QuoteReading = ReturnType<typeof readQuote>

function renewalLine(r: QuoteReading): string {
  const amount = r.money(r.recurringCents)
  return r.quote.renewal_at === undefined
    ? r.t(`${S}.trailing.renewsAtAmount`, { amount })
    : r.t(`${S}.trailing.renewsAt`, {
        amount,
        date: r.date(r.quote.renewal_at)
      })
}

function refillsToLine(r: QuoteReading): string {
  return r.t(r.byNew.refillsTo, {
    credits: r.credits(r.quote.credits_next_period_cents)
  })
}

function scheduledLedger(r: QuoteReading): SummaryLedger {
  const startsAt = r.date(r.quote.effective_at)
  const current = r.current
  return {
    ...r.shared,
    family: 'scheduled',
    headline: {
      amount: r.headlineMoney(r.recurringCents),
      currency: r.currency,
      rate: r.t(r.byNew.rate, {})
    },
    credits: {
      count: r.credits(r.quote.credits_next_period_cents),
      qualifier: r.t(r.byNew.refillAfter, { date: startsAt })
    },
    items: [
      {
        label: r.plan,
        amount: r.t(r.byNew.itemRate, { amount: r.money(r.recurringCents) }),
        sublines: [r.t(r.byNew.startsOn, { date: startsAt })]
      }
    ],
    trailing:
      current === undefined
        ? []
        : [
            r.t(`${S}.trailing.keepUntil`, {
              plan: r.cadenceChanges
                ? r.planLabel(current, true)
                : r.tierName(current.tier),
              date: startsAt
            })
          ]
  }
}

/** Today's grant, dated by the server's renewal when it carries one. */
function grantedToday(r: QuoteReading): SummaryLedger['credits'] {
  const expiresAt = r.quote.renewal_at
  return {
    count: r.credits(r.quote.credits_today_cents),
    qualifier:
      expiresAt === undefined
        ? r.t(`${S}.credits.addedToday`, {})
        : r.t(`${S}.credits.addedTodayExpire`, {
            date: r.monthDay(expiresAt)
          })
  }
}

function proratedLedger(r: QuoteReading): SummaryLedger {
  return {
    ...r.shared,
    family: 'prorated_change',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: grantedToday(r),
    items: [
      {
        label: r.t(`${S}.item.prorated`, { plan: r.plan }),
        amount: r.money(r.quote.cost_today_cents),
        sublines: [
          r.t(`${S}.item.remainingTime`, {
            plan: r.tierName(r.next.tier),
            current: r.tierName(r.current?.tier ?? r.next.tier)
          }),
          refillsToLine(r)
        ]
      }
    ],
    trailing: [r.t(`${S}.trailing.creditsKept`, {}), renewalLine(r)]
  }
}

/**
 * The credits line reads today's grant. It doubles as the recurring
 * allowance only when the quote says the two are equal; a smaller grant
 * (a legacy upgrade quoted without a proration instant) is dated instead.
 */
function chargeNowCredits(r: QuoteReading): SummaryLedger['credits'] {
  if (!grantIsAllowance(r)) return grantedToday(r)
  return {
    count: r.credits(r.quote.credits_today_cents),
    qualifier: r.t(
      r.cadenceChanges ? `${S}.credits.bare` : r.byNew.perPeriod,
      {}
    )
  }
}

function grantIsAllowance(r: QuoteReading): boolean {
  return r.quote.credits_today_cents === r.quote.credits_next_period_cents
}

function chargeNowTrailing(r: QuoteReading): string[] {
  const { quote, current } = r
  const overlapUntil =
    r.cadenceChanges && current?.duration === 'MONTHLY'
      ? current.period_end
      : undefined
  const zeroDueRenewal =
    quote.transition_type === 'new_subscription' && r.dueCents === 0
      ? quote.renewal_at
      : undefined
  return [
    renewalLine(r),
    ...(overlapUntil === undefined
      ? []
      : [
          r.t(`${S}.trailing.creditsOverlap`, {
            date: r.date(overlapUntil)
          })
        ]),
    ...(zeroDueRenewal === undefined
      ? []
      : [
          r.t(`${S}.trailing.zeroDue`, {
            amount: r.money(r.recurringCents),
            date: r.date(zeroDueRenewal)
          })
        ])
  ]
}

function chargeNowLedger(r: QuoteReading): SummaryLedger {
  const cadenceLine =
    r.next.duration === 'MONTHLY'
      ? r.t(`${S}.item.billedMonthly`, {
          amount: r.headlineMoney(r.next.seat_summary.total_cost_cents)
        })
      : r.t(`${S}.item.billedYearly`, {})
  return {
    ...r.shared,
    family: 'charge_now',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: chargeNowCredits(r),
    items: [
      {
        label: r.plan,
        amount: r.money(r.quote.cost_today_cents),
        sublines:
          r.cadenceChanges || !grantIsAllowance(r)
            ? [cadenceLine, refillsToLine(r)]
            : [cadenceLine]
      }
    ],
    trailing: chargeNowTrailing(r)
  }
}

/**
 * Maps a quote onto the summary column. Every number is one the server
 * reported; a slot whose number the quote does not carry is left out rather
 * than derived. The family is the server's too: an immediate `upgrade`
 * priced at a `proration_at` instant is prorated, while a reset-to-yearly
 * `duration_change` carries `proration_at` but charges in full. A team commit
 * change is held at the neutral charge until its proration copy is confirmed.
 */
export function buildSummaryLedger(
  quote: SubscriptionPreview,
  context: LedgerContext
): SummaryLedger {
  const reading = readQuote(quote, context)
  if (!quote.is_immediate) return scheduledLedger(reading)
  if (
    quote.transition_type === 'upgrade' &&
    quote.proration_at !== undefined &&
    !reading.commitChange
  )
    return proratedLedger(reading)
  return chargeNowLedger(reading)
}
