import type {
  BillingPlansData,
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import {
  TIER_CATALOG,
  getStopDiscountedMonthlyUsd,
  mapApiTeamCreditStops,
  toCatalogTierKey
} from '@comfyorg/account-ui/billing/catalog'
import type { CheckoutPlan } from '@comfyorg/account-ui/billing/checkout'
import { isAnnualDuration } from '@comfyorg/account-ui/billing/checkout'

type TeamCreditStops = NonNullable<BillingPlansData['team_credit_stops']>

/**
 * A team credit stop is priced and granted by the stop, through the same
 * catalog the app's pricing table and confirm read.
 */
export function teamCheckoutPlan(
  quoted: SubscriptionPreview,
  stops: TeamCreditStops | undefined,
  stopId: string,
  name: string
): CheckoutPlan {
  const cycle = isAnnualDuration(quoted.new_plan.duration)
    ? 'yearly'
    : 'monthly'
  const stop = mapApiTeamCreditStops(
    (stops?.stops ?? []).map((candidate) => ({
      id: candidate.id,
      credits: Number(candidate.credits),
      yearly: {
        list_price_cents: Number(candidate.yearly.list_price_cents),
        price_cents: Number(candidate.yearly.price_cents)
      }
    }))
  ).find((candidate) => candidate.id === stopId)
  const monthlyUsd = stop ? getStopDiscountedMonthlyUsd(stop, cycle) : 0
  return {
    name,
    monthlyPriceUsd: { monthly: monthlyUsd, yearly: monthlyUsd },
    monthlyCredits: stop?.credits ?? 0,
    pricedByQuote: false
  }
}

/** A tier plan reads its grant from the shared catalog; the quote prices it. */
export function tierCheckoutPlan(
  quoted: SubscriptionPreview,
  name: string
): CheckoutPlan {
  const tierKey = toCatalogTierKey(quoted.new_plan.tier)
  const tier = tierKey && TIER_CATALOG[tierKey]
  return {
    name,
    monthlyPriceUsd: { monthly: tier?.monthly ?? 0, yearly: tier?.yearly ?? 0 },
    monthlyCredits: tier?.credits ?? 0,
    pricedByQuote: true
  }
}

export interface PaymentChoice {
  readonly confirmationToken?: string
  readonly methodType?: string
  readonly savedPaymentMethodId?: string
  readonly confirmReactivation?: boolean
}

/** A method other than a card authenticates on its own site, so the page leaves while it pays. */
export function paysOnOwnSite(methodType: string | undefined): boolean {
  return methodType !== undefined && methodType !== 'card'
}

export interface SubscribeContext {
  readonly planSlug: string
  readonly teamCreditStopId?: string
  readonly returnUrl?: string
}

function present<Key extends keyof SubscribeInput>(
  key: Key,
  value: SubscribeInput[Key] | undefined
): Partial<SubscribeInput> {
  return value === undefined ? {} : { [key]: value }
}

/**
 * The quote's identity travels with the charge, so the server prices what
 * the customer saw. A card entered here travels as `confirmation_token`; a
 * saved method as its id; a plan change carries neither, and the server
 * charges the method on file. A change that takes effect later is priced
 * when it does, so only an immediate quote pins `proration_at`.
 */
export function buildSubscribeRequest(
  context: SubscribeContext,
  quoted: SubscriptionPreview,
  choice: PaymentChoice
): SubscribeInput {
  return {
    plan_slug: context.planSlug,
    ...present('confirmation_token', choice.confirmationToken),
    ...present('saved_payment_method_id', choice.savedPaymentMethodId),
    ...present('team_credit_stop_id', context.teamCreditStopId),
    ...present('quote_id', quoted.quote_id),
    ...present('quote_version', quoted.quote_version),
    ...present('promotion_code', quoted.promotion_code || undefined),
    ...present(
      'proration_at',
      quoted.is_immediate ? quoted.proration_at : undefined
    ),
    ...present('return_url', context.returnUrl),
    ...present('confirm_reactivation', choice.confirmReactivation || undefined)
  }
}
