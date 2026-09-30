import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { longDate, monthDay } from '@/checkout/longDate'

/** The four summary families of the checkout guidebook; `top_up` is built by `topupLedger`. */
type SummaryFamily = 'charge_now' | 'prorated_change' | 'scheduled' | 'top_up'

/**
 * A discounted plan rate beside the list price it replaces, both as the
 * server priced them. The list price is the one amount the summary strikes
 * through.
 */
interface ComparedRate {
  readonly keypath: string
  readonly amount: string
  readonly listAmount: string
}

/** A ledger line: a label and its sublines on the left, dollars on the right. */
interface LedgerRow {
  readonly label: string
  readonly amount: string
  readonly comparedRate?: ComparedRate
  readonly sublines: readonly string[]
}

/**
 * A deduction from today's charge: what it is on the left, what it removed on
 * the right. A discount's code lives on a chip; its subline bounds its term.
 */
export interface DiscountRow {
  readonly label: string
  readonly amount?: string
  readonly subline?: string
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
    /** A credits-first headline leads with the credits icon. */
    readonly icon?: 'coins'
  }
  readonly credits?: { readonly count: string; readonly qualifier: string }
  /** Money rows the total reconciles with; see `moneyItems`. */
  readonly items: readonly LedgerRow[]
  /** Every promotion the quote applied, held or entered, in the server's order. */
  readonly discounts: readonly DiscountRow[]
  /** The server's pre-discount total, only when a discount follows two or more money rows. */
  readonly subtotal?: string
  /** Credit already on the account that the server applied to today's charge. */
  readonly balance?: DiscountRow
  readonly chips: readonly PromoChip[]
  /** Codes apply to a charge made today, so only those families take one. */
  readonly acceptsPromo: boolean
  readonly total: string
  readonly trailing: readonly string[]
}

type DiscountSlots = Pick<
  SummaryLedger,
  'discounts' | 'subtotal' | 'balance' | 'chips' | 'acceptsPromo'
>

type FamilyLedger = Omit<SummaryLedger, keyof DiscountSlots>

type Translate = (
  key: string,
  named: Record<string, unknown>,
  plural?: number
) => string
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
    comparedRate: `${S}.item.comparedMonthly`,
    onceTerm: `${S}.discount.firstMonth`,
    perPeriod: `${S}.credits.perMonth`,
    refillAfter: `${S}.credits.refillMonthlyAfter`,
    refillsTo: `${S}.item.refillsMonthly`,
    startsOn: `${S}.item.startsMonthly`
  },
  ANNUAL: {
    cadence: `${S}.cadence.yearly`,
    rate: `${S}.rate.yearly`,
    itemRate: `${S}.item.rateYearly`,
    comparedRate: `${S}.item.comparedYearly`,
    onceTerm: `${S}.discount.firstYear`,
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
    date: (iso: string) => longDate(iso, locale),
    /** Month and day only: a credits expiry always falls within the current period. */
    monthDay: (iso: string) => monthDay(iso, locale),
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
 * charge equals the row, or a discount or balance row itemizes the
 * difference. A $0 first period or a credit the quote does not itemize would
 * leave the row contradicting the total, so it comes off and the total
 * stands on its own.
 */
function moneyItems(
  r: QuoteReading,
  cents: number,
  row: Omit<LedgerRow, 'amount'>
): LedgerRow[] {
  const itemized =
    r.promotions.length > 0 || r.quote.balance_applied_cents !== undefined
  return cents === r.dueCents || itemized
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

/**
 * A team plan is one tier at many commitments, so the kept one is named by
 * its rate. A kept yearly plan always names its cadence.
 */
function keptPlanLine(r: QuoteReading, current: Plan, until: string): string {
  const plan = namedPlan(
    r,
    current,
    r.cadenceChanges || current.duration === 'ANNUAL'
  )
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
    trailing: [
      r.t(`${S}.trailing.creditsKept`, {}),
      renewalLine(r),
      ...zeroDueLine(r)
    ]
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
  const { current } = r
  const overlapUntil =
    r.cadenceChanges && current?.duration === 'MONTHLY'
      ? current.period_end
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
    ...zeroDueLine(r)
  ]
}

/** A $0 total still collects a method, so the summary says what it will pay. */
function zeroDueLine(r: QuoteReading): string[] {
  if (r.dueCents !== 0) return []
  const amount = r.money(r.recurringCents)
  const renewsAt = r.quote.renewal_at
  return [
    renewsAt === undefined
      ? r.t(`${S}.trailing.zeroDueUndated`, { amount })
      : r.t(`${S}.trailing.zeroDue`, { amount, date: r.date(renewsAt) })
  ]
}

/**
 * The rate a plan discount (the yearly or team-commitment price) brought
 * down from its list price, both as the server rated them.
 */
function comparedRateOf(r: QuoteReading): ComparedRate | undefined {
  const listCents = r.next.list_price_cents
  if (listCents === undefined || listCents <= r.next.price_cents)
    return undefined
  return {
    keypath: r.byNew.comparedRate,
    amount: r.headlineMoney(r.next.price_cents),
    listAmount: r.headlineMoney(listCents)
  }
}

function cadenceLineOf(r: QuoteReading): string {
  return r.next.duration === 'MONTHLY'
    ? r.t(`${S}.item.billedMonthly`, {
        amount: r.headlineMoney(r.next.seat_summary.total_cost_cents)
      })
    : r.t(`${S}.item.billedYearly`, {})
}

function chargeNowLedger(r: QuoteReading): FamilyLedger {
  const comparedRate = comparedRateOf(r)
  const refills =
    r.cadenceChanges || !grantIsAllowance(r) ? [refillsToLine(r)] : []
  return {
    ...r.shared,
    family: 'charge_now',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: chargeNowCredits(r),
    items: moneyItems(
      r,
      r.quote.cost_today_cents,
      comparedRate === undefined
        ? { label: r.plan, sublines: [cadenceLineOf(r), ...refills] }
        : { label: r.plan, comparedRate, sublines: refills }
    ),
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
  return { ...ledger, ...discountSlots(reading, ledger.items.length) }
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

const deduction = (r: QuoteReading, cents: number) =>
  r.t(`${S}.discount.amount`, { amount: r.money(cents) })

/**
 * How long a coupon keeps applying, stated as bounds only: `once` covers the
 * first period, `repeating` its months, and `forever` needs no subline.
 */
function discountTerm(r: QuoteReading, discount: Discount): string | undefined {
  if (discount.duration === 'once') return r.t(r.byNew.onceTerm, {})
  const months = discount.duration_in_months
  if (discount.duration !== 'repeating' || months === undefined)
    return undefined
  return r.t(`${S}.discount.forMonths`, { count: months }, months)
}

function discountRow(r: QuoteReading, discount: Discount): DiscountRow {
  const subline = discountTerm(r, discount)
  return {
    label: discount.name ?? r.t(`${S}.discount.fallbackLabel`, {}),
    ...(discount.amount_off_cents === undefined
      ? {}
      : { amount: deduction(r, discount.amount_off_cents) }),
    ...(subline === undefined ? {} : { subline })
  }
}

function balanceRow(r: QuoteReading): DiscountRow | undefined {
  const cents = r.quote.balance_applied_cents
  if (cents === undefined) return undefined
  return {
    label: r.t(`${S}.balance.label`, {}),
    amount: deduction(r, cents),
    subline: r.t(`${S}.balance.subline`, {})
  }
}

/**
 * Subtotal names the base a discount came off, so it shows only where a
 * discount follows two or more money rows; above a single row it would
 * repeat that row.
 */
function subtotalOf(
  r: QuoteReading,
  moneyRows: number,
  discountRows: number
): string | undefined {
  const cents = r.quote.subtotal_cents
  if (cents === undefined || moneyRows < 2 || discountRows === 0)
    return undefined
  return r.money(cents)
}

/**
 * Every promotion gets a row, in the order the server listed them and at the
 * amount it reported. The `promotion` discount matching the quote's
 * `promotion_code` is the customer's entered code, the only chip that comes
 * off; any other is one the account already holds.
 */
function discountSlots(r: QuoteReading, moneyRows: number): DiscountSlots {
  const enteredCode = r.quote.promotion_code?.toUpperCase()
  const held = r.promotions.filter(
    (discount) => discount.code.toUpperCase() !== enteredCode
  )
  const subtotal = subtotalOf(r, moneyRows, r.promotions.length)
  const balance = balanceRow(r)
  return {
    discounts: r.promotions.map((discount) => discountRow(r, discount)),
    ...(subtotal === undefined ? {} : { subtotal }),
    ...(balance === undefined ? {} : { balance }),
    chips: [
      ...held.map(({ code }) => ({ code, removable: false })),
      ...(r.quote.promotion_code === undefined
        ? []
        : [{ code: r.quote.promotion_code, removable: true }])
    ],
    acceptsPromo: acceptsPromoCode(r.quote)
  }
}
