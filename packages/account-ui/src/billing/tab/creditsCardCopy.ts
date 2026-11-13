import { CREDITS_PER_USD, formatPlanDate } from '@comfyorg/account-core/billing'
import type { PlanCreditsState } from '@comfyorg/account-core/billing'

export { CREDITS_PER_USD }

/** Host-translated strings for the Credits card. */
export interface CreditsCardCopy {
  readonly title: string
  readonly rateInfo: string
  readonly rateTooltip: string
  readonly available: string
  readonly unavailable: string
  readonly tryAgain: string
  readonly overdrawn: (count: string, credits: number) => string
  readonly plan: string
  readonly planTooltip: string
  /** Template holding the `{remaining}` and `{total}` placeholders. */
  readonly planOfPool: string
  readonly planUsed: (percent: number) => string
  readonly refills: (date: string) => string
  readonly refillsAfterPayment: string
  readonly availableUntil: (date: string) => string
  readonly topUp: string
  readonly topUpTooltip: string
  readonly inUse: string
  readonly addCredits: string
  readonly addCreditsReason: (reasonKey: string) => string
}

const WHOLE: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}

/** Whole credits for a served cent amount. */
export function centsToCredits(cents: number): number {
  return Math.round((cents * CREDITS_PER_USD) / 100)
}

/** Locale-grouped whole credits. */
export function formatWholeCredits(credits: number, locale: string): string {
  return new Intl.NumberFormat(locale, WHOLE).format(credits)
}

/** The share of the plan pool already spent, or null when usage is not shown. */
export function planUsedPercent(plan: PlanCreditsState): number | null {
  if (!plan.showUsage || !plan.planPoolCredits) return null
  const remaining = centsToCredits(plan.planCents) / plan.planPoolCredits
  return Math.round(Math.min(Math.max(1 - remaining, 0), 1) * 100)
}

/** Host-translated strings for the credits flyout breakdown. */
export interface CreditsBreakdownCopy extends Pick<
  CreditsCardCopy,
  | 'planOfPool'
  | 'refills'
  | 'refillsAfterPayment'
  | 'availableUntil'
  | 'unavailable'
> {
  readonly planCredits: string
  readonly topUpCredits: string
}

type PlanDateCopy = Pick<
  CreditsCardCopy,
  'refills' | 'refillsAfterPayment' | 'availableUntil'
>

/** The plan pool's refill or availability line; a null cadence keeps the year. */
export function planDateLine(
  plan: PlanCreditsState,
  copy: PlanDateCopy,
  locale: string,
  cadence: 'monthly' | 'yearly' | null = null
): string {
  if (plan.planDate.kind === 'afterPayment') return copy.refillsAfterPayment
  const date = plan.planDate.date
    ? formatPlanDate(plan.planDate.date, locale, cadence)
    : ''
  if (!date) return ''
  return plan.planDate.kind === 'refills'
    ? copy.refills(date)
    : copy.availableUntil(date)
}

/** The plan-of-pool template split around the remaining amount. */
export function splitPlanOfPool(
  template: string,
  total: string
): { before: string; after: string } {
  const [before = '', after = ''] = template
    .replaceAll('{total}', total)
    .split('{remaining}')
  return { before, after }
}
