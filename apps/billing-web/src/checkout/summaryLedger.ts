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
  /** A credit the server subtracts, muted like a deduction. */
  readonly credit?: true
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

/**
 * The server's credit count. The cents fallback serves a server without
 * cloud PR 11905 and misses the receipt by a credit; delete it once every
 * preview carries the count.
 */
function grantedCredits(count: number | undefined, cents: number): number {
  return count ?? centsToCredits(cents)
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
  const formatCount = new Intl.NumberFormat(locale).format
  const todayCount = grantedCredits(
    quote.credits_today,
    quote.credits_today_cents
  )
  const nextPeriodCount = grantedCredits(
    quote.credits_next_period,
    quote.credits_next_period_cents
  )

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
    todayCount,
    nextPeriodCount,
    creditsToday: formatCount(todayCount),
    creditsNextPeriod: formatCount(nextPeriodCount),
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
    credits: r.creditsNextPeriod
  })
}

/**
 * Money rows render only when the total reconciles with them: today's
 * charge equals their net, or a discount or balance row itemizes the
 * difference. A $0 first period or a credit the quote does not itemize would
 * leave the rows contradicting the total, so they come off and the total
 * stands on its own.
 */
function moneyItems(
  r: QuoteReading,
  netCents: number,
  rows: readonly LedgerRow[]
): readonly LedgerRow[] {
  const itemized =
    r.promotions.length > 0 || r.quote.balance_applied_cents !== undefined
  return netCents === r.dueCents || itemized ? rows : []
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
      count: r.creditsNextPeriod,
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
    count: r.creditsToday,
    qualifier:
      expiresAt === undefined
        ? r.t(`${S}.credits.addedToday`, {})
        : r.t(`${S}.credits.addedTodayExpire`, {
            date: r.monthDay(expiresAt)
          })
  }
}

/**
 * A quote that itemizes its proration reads as the remaining time on the new
 * plan and the unused-time credit from the old one, at the server's amounts.
 * Otherwise one net row stands for both.
 */
function proratedItems(r: QuoteReading): LedgerRow[] {
  const remainingCents = r.quote.proration_remaining_cents
  const unusedCents = r.quote.proration_unused_cents
  if (remainingCents === undefined || unusedCents === undefined)
    return [
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
    ]
  const current = r.current ?? r.next
  return [
    {
      label: r.t(`${S}.item.remainingTimeOn`, { plan: r.plan }),
      amount: r.money(remainingCents),
      sublines: [refillsToLine(r)]
    },
    {
      label: r.t(`${S}.item.unusedTimeOn`, {
        plan: r.planLabel(current, r.cadenceChanges)
      }),
      amount: deduction(r, unusedCents),
      sublines: [],
      credit: true
    }
  ]
}

function proratedLedger(r: QuoteReading): FamilyLedger {
  return {
    ...r.shared,
    family: 'prorated_change',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: grantedToday(r),
    items: moneyItems(r, r.quote.cost_today_cents, proratedItems(r)),
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
    count: r.creditsToday,
    qualifier: r.t(
      r.cadenceChanges ? `${S}.credits.bare` : r.byNew.perPeriod,
      {}
    )
  }
}

function grantIsAllowance(r: QuoteReading): boolean {
  const { quote } = r
  if (
    quote.credits_today === undefined &&
    quote.credits_next_period === undefined
  )
    return quote.credits_today_cents === quote.credits_next_period_cents
  return r.todayCount === r.nextPeriodCount
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
 * The plan's rate under its label: struck against the list price whenever
 * the server sends one, else a plain cadence line. A yearly plan the server
 * also rates per month reads in those monthly figures.
 */
type RateLine =
  | { readonly comparedRate: ComparedRate }
  | { readonly subline: string }

function rateLineOf(r: QuoteReading): RateLine {
  const monthlyCents = r.next.monthly_price_cents
  if (r.next.duration === 'ANNUAL' && monthlyCents !== undefined) {
    const amount = r.headlineMoney(monthlyCents)
    const listCents = r.next.monthly_list_price_cents
    return listCents === undefined
      ? { subline: r.t(`${S}.item.billedYearlyMonthly`, { amount }) }
      : {
          comparedRate: {
            keypath: `${S}.item.comparedYearlyMonthly`,
            amount,
            listAmount: r.headlineMoney(listCents)
          }
        }
  }
  const listCents = r.next.list_price_cents
  return listCents === undefined
    ? { subline: cadenceLineOf(r) }
    : {
        comparedRate: {
          keypath: r.byNew.comparedRate,
          amount: r.headlineMoney(r.next.price_cents),
          listAmount: r.headlineMoney(listCents)
        }
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
  const rateLine = rateLineOf(r)
  const refills =
    r.cadenceChanges || !grantIsAllowance(r) ? [refillsToLine(r)] : []
  return {
    ...r.shared,
    family: 'charge_now',
    headline: { amount: r.headlineMoney(r.dueCents), currency: r.currency },
    credits: chargeNowCredits(r),
    items: moneyItems(r, r.quote.cost_today_cents, [
      {
        label: r.plan,
        amount: r.money(r.quote.cost_today_cents),
        ...('comparedRate' in rateLine
          ? { comparedRate: rateLine.comparedRate, sublines: refills }
          : { sublines: [rateLine.subline, ...refills] })
      }
    ]),
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

/** What a deduction row needs to word itself, shared by the summary and the Success card. */
export interface DeductionFormat {
  readonly t: Translate
  readonly money: (cents: number) => string
}

const deduction = (format: DeductionFormat, cents: number) =>
  format.t(`${S}.discount.amount`, { amount: format.money(cents) })

type DiscountTerm = NonNullable<Discount['term']>

/** How long a discount keeps applying, worded from the term the server reported. */
const TERM_LINE = {
  this_payment: (t) => t(`${S}.discount.thisPaymentOnly`, {}),
  first_month: (t) => t(`${S}.discount.firstMonth`, {}),
  first_year: (t) => t(`${S}.discount.firstYear`, {}),
  months: (t, months) =>
    months === undefined
      ? undefined
      : t(`${S}.discount.forMonths`, { count: months }, months),
  ongoing: () => undefined
} satisfies Record<
  DiscountTerm,
  (t: Translate, months: number | undefined) => string | undefined
>

export function discountRow(
  format: DeductionFormat,
  discount: Pick<Discount, 'name' | 'term' | 'duration_in_months'>,
  amountCents: number | undefined
): DiscountRow {
  const subline =
    discount.term === undefined
      ? undefined
      : TERM_LINE[discount.term](format.t, discount.duration_in_months)
  return {
    label: discount.name ?? format.t(`${S}.discount.fallbackLabel`, {}),
    ...(amountCents === undefined
      ? {}
      : { amount: deduction(format, amountCents) }),
    ...(subline === undefined ? {} : { subline })
  }
}

export function balanceRow(
  format: DeductionFormat,
  cents: number
): DiscountRow {
  return {
    label: format.t(`${S}.balance.label`, {}),
    amount: deduction(format, cents),
    subline: format.t(`${S}.balance.subline`, {})
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
  const format = { t: r.t, money: r.money }
  const balanceCents = r.quote.balance_applied_cents
  const balance =
    balanceCents === undefined ? undefined : balanceRow(format, balanceCents)
  return {
    discounts: r.promotions.map((discount) =>
      discountRow(format, discount, discount.amount_off_cents)
    ),
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
