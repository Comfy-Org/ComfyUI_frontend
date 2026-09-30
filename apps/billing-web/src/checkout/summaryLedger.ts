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
 * A discount the quote applied: what it is on the left, what it removed from
 * today's charge on the right. The code that produced it lives on a chip.
 */
interface DiscountRow {
  readonly label: string
  readonly amount?: string
}

/** Which code produced a discount. Only the customer's own code comes off. */
export interface PromoChip {
  readonly code: string
  readonly removable: boolean
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
  /** Money rows the total reconciles with; see `moneyItems`. */
  readonly items: readonly LedgerRow[]
  /** Discounts the customer already holds, priced before any entered code. */
  readonly adjustments: readonly DiscountRow[]
  /**
   * The pre-discount base an entered code applied to. The quote carries
   * no such field today, so no builder populates this; it stays typed for
   * when the server reports one, and the row renders only then.
   */
  readonly subtotal?: string
  /** The row for the code the customer entered. */
  readonly promo?: DiscountRow
  readonly chips: readonly PromoChip[]
  /** Codes apply to a charge made today, so only those families take one. */
  readonly acceptsPromo: boolean
  readonly total: string
  readonly trailing: readonly string[]
}

type DiscountSlots = Pick<
  SummaryLedger,
  'adjustments' | 'subtotal' | 'promo' | 'chips' | 'acceptsPromo'
>

type FamilyLedger = Omit<SummaryLedger, keyof DiscountSlots>

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

function planLabeller({ t, tierName }: Pick<LedgerContext, 't' | 'tierName'>) {
  return (plan: Pick<Plan, 'tier' | 'duration'>, cadenceShown: boolean) =>
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
    /**
     * The discounts that get a row. A `plan` discount is a catalog coupon the
     * price is built from (the annual or team-commitment rate), already
     * inside the item's amount, so it never does.
     */
    promotions: (quote.discounts ?? []).filter(
      (discount) => discount.kind === 'promotion'
    ),
    shared: {
      eyebrow: eyebrowOf(action, context),
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

/**
 * A money row renders only when the total reconciles with it: today's
 * charge equals the row, or a discount row itemizes the difference. A $0
 * first period or a credit on file the quote does not itemize would leave
 * the row contradicting the total, so it comes off and the total stands on
 * its own.
 */
function moneyItems(
  r: QuoteReading,
  cents: number,
  row: Omit<LedgerRow, 'amount'>
): LedgerRow[] {
  return cents === r.dueCents || r.promotions.length > 0
    ? [{ ...row, amount: r.money(cents) }]
    : []
}

function scheduledLedger(r: QuoteReading): FamilyLedger {
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
    trailing: current === undefined ? [] : [keptPlanLine(r, current, startsAt)]
  }
}

/** A plan named in a sentence: "Pro", or "Pro Yearly" when its cadence matters. */
export function namedPlan(
  context: Pick<LedgerContext, 't' | 'tierName'>,
  plan: Pick<Plan, 'tier' | 'duration'>,
  cadenceShown: boolean
): string {
  return cadenceShown
    ? planLabeller(context)(plan, true)
    : context.tierName(plan.tier)
}

/** A team plan is one tier at many commitments, so the kept one is named by its rate. */
function keptPlanLine(r: QuoteReading, current: Plan, until: string): string {
  const plan = namedPlan(r, current, r.cadenceChanges)
  if (!r.commitChange)
    return r.t(`${S}.trailing.keepUntil`, { plan, date: until })
  return r.t(`${S}.trailing.keepCommitmentUntil`, {
    plan,
    rate: r.t(BY_DURATION[current.duration].itemRate, {
      amount: r.money(current.seat_summary.total_cost_cents)
    }),
    date: until
  })
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

function proratedLedger(r: QuoteReading): FamilyLedger {
  return {
    ...r.shared,
    family: 'prorated_change',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: grantedToday(r),
    items: moneyItems(r, r.quote.cost_today_cents, {
      label: r.t(`${S}.item.prorated`, { plan: r.plan }),
      sublines: [
        r.t(`${S}.item.remainingTime`, {
          plan: r.tierName(r.next.tier),
          current: r.tierName(r.current?.tier ?? r.next.tier)
        }),
        refillsToLine(r)
      ]
    }),
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

function chargeNowLedger(r: QuoteReading): FamilyLedger {
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
    items: moneyItems(r, r.quote.cost_today_cents, {
      label: r.plan,
      sublines:
        r.cadenceChanges || !grantIsAllowance(r)
          ? [cadenceLine, refillsToLine(r)]
          : [cadenceLine]
    }),
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
  const ledger = familyLedger(reading)
  return { ...ledger, ...discountSlots(reading) }
}

function familyLedger(r: QuoteReading): FamilyLedger {
  if (!r.quote.is_immediate) return scheduledLedger(r)
  if (
    r.quote.transition_type === 'upgrade' &&
    r.quote.proration_at !== undefined &&
    !r.commitChange
  )
    return proratedLedger(r)
  return chargeNowLedger(r)
}

/** The server refuses a code on a change that charges nothing today. */
export function acceptsPromoCode(quote: SubscriptionPreview): boolean {
  return quote.is_immediate
}

type Discount = NonNullable<SubscriptionPreview['discounts']>[number]

/**
 * The `promotion` discount matching the quote's `promotion_code` is the
 * customer's entered code, any other is one the account already holds.
 * Subtotal would name the base the entered code applied to, but the quote
 * carries no pre-discount total, so this builder never sets it. Computing
 * one as today's charge plus what the code took would be a frontend guess
 * at a number the server is supposed to report.
 */
function discountSlots(r: QuoteReading): DiscountSlots {
  const enteredCode = r.quote.promotion_code
  const entered = r.promotions.find(
    (discount) => discount.code.toUpperCase() === enteredCode?.toUpperCase()
  )
  const held = r.promotions.filter((discount) => discount !== entered)
  const rowOf = (discount: Discount) => ({
    label: discount.name ?? r.t(`${S}.discount.fallbackLabel`, {}),
    ...(discount.amount_off_cents === undefined
      ? {}
      : {
          amount: r.t(`${S}.discount.amount`, {
            amount: r.money(discount.amount_off_cents)
          })
        })
  })
  return {
    adjustments: held.map(rowOf),
    ...(entered === undefined ? {} : { promo: rowOf(entered) }),
    chips: [
      ...held.map(({ code }) => ({ code, removable: false })),
      ...(enteredCode === undefined
        ? []
        : [{ code: enteredCode, removable: true }])
    ],
    acceptsPromo: acceptsPromoCode(r.quote)
  }
}
