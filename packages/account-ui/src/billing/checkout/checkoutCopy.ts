import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import type { StripePaymentCopy } from '../stripe/stripePaymentPhase'

/**
 * Host-translated strings for the checkout surfaces. Interpolated strings
 * are functions of typed params, so the package carries no i18n runtime and
 * a host cannot leave a placeholder unfilled. Sentences that wrap an element
 * around a placeholder keep the `{name}` token and are split at render time.
 */
export interface CheckoutTermsCopy {
  /** Carries `{terms}` and `{privacy}` for the two links. */
  readonly agreement: string
  readonly terms: string
  readonly privacyPolicy: string
}

export interface CheckoutSavedMethodCopy {
  readonly savedPaymentMethod: string
  readonly changePaymentMethod: string
  readonly addNewPaymentMethod: string
  readonly alipay: string
  readonly selectLabel: string
}

type DiscountKind = NonNullable<
  SubscriptionPreview['discounts']
>[number]['kind']

export interface CheckoutReactivationCopy {
  readonly title: string
  readonly titleAnnual: string
  /** Bodies carry `{plan} {date} {newPlan} {nextDate} {amount}` tokens. */
  readonly upgradeBody: string
  readonly downgradeBody: string
  readonly durationChangeBody: string
  readonly durationChangeBodyMonthly: string
  /** The same bodies without the renewal clause, for a quote with no renewal date. */
  readonly withoutRenewalDate: {
    readonly upgradeBody: string
    readonly downgradeBody: string
    readonly durationChangeBody: string
    readonly durationChangeBodyMonthly: string
  }
  readonly confirmButton: string
  readonly confirmButtonWithCharge: (amount: string) => string
  readonly checkboxLabel: (amount: string) => string
}

export interface CheckoutCopy {
  readonly back: string
  readonly usdPerMonth: string
  readonly billedMonthly: string
  readonly billedYearly: (total: string) => string
  readonly eachMonthCreditsRefill: string
  readonly eachYearCreditsRefill: string
  readonly totalDueToday: string
  readonly renewsAt: (amount: string, date: string) => string
  readonly renewsAtAmount: (amount: string) => string
  readonly discount: Readonly<Record<DiscountKind, string>>
  readonly promoCodePlaceholder: string
  readonly applyPromoCode: string
  readonly reconciliationTitle: string
  readonly reconciliationDetail: string
  readonly authenticationFailedDetail: string
  readonly pendingVerificationDetail: string
  readonly completeVerification: string
  readonly confirmPayment: string
  readonly startingToday: string
  readonly parkedCheckoutDetail: string
  readonly completePayment: string
  readonly payAndSubscribe: string
  readonly subscribeToPlan: (plan: string) => string
  readonly confirmUpgradeTitle: string
  readonly confirmChangeTitle: string
  readonly switchesToday: string
  readonly startsOn: (date: string) => string
  readonly creditsYoullGetToday: string
  readonly refillReplacesNote: string
  readonly afterThat: string
  readonly creditsRefillMonthlyTo: string
  readonly billedEachMonth: (amount: string) => string
  readonly discountComposition: string
  readonly quoteUnavailable: string
  readonly confirmUpgradeCta: string
  readonly confirmChange: string
  readonly reactivation: CheckoutReactivationCopy
  readonly savedMethod: CheckoutSavedMethodCopy
  readonly terms: CheckoutTermsCopy
  readonly payment: StripePaymentCopy
}

export interface CheckoutSuccessCopy {
  readonly allSet: string
  readonly planUpdated: string
  readonly receiptEmailed: string
  readonly usdPerMonth: string
  readonly usdPerYear: string
  readonly perMonth: string
  readonly perYear: string
  readonly promoApplied: (code: string) => string
  readonly promoRenews: (amount: string, date: string) => string
  readonly close: string
}

export interface CheckoutInviteCopy {
  readonly title: string
  readonly subtext: string
  readonly placeholder: string
  readonly sendInvites: string
  readonly removeTag: string
  readonly invalidEmailCount: (count: number) => string
  readonly pendingInviteSingle: string
  readonly pendingInviteCount: (count: number) => string
  readonly seatLimitExceeded: (max: number, overage: number) => string
  readonly invitedMessage: (emails: string, count: number) => string
  readonly failedCount: (count: number) => string
}

export type CopySegment<Key extends string> =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'slot'; readonly key: Key }

/**
 * Splits `text` at each `{key}` so a template can render the surrounding
 * prose as text and each placeholder as its own element.
 */
export function splitPlaceholders<Key extends string>(
  text: string,
  keys: readonly Key[]
): CopySegment<Key>[] {
  const pattern = new RegExp(`\\{(${keys.join('|')})\\}`, 'g')
  const segments: CopySegment<Key>[] = []
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, match.index) })
    }
    const key = keys.find((candidate) => candidate === match[1])
    if (key !== undefined) segments.push({ kind: 'slot', key })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) })
  }
  return segments
}
