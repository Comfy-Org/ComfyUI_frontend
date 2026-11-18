import type {
  InteractiveTopupPayment,
  SavedPaymentMethod,
  TopupResult
} from '@comfyorg/account-core/billing'
import { isPurchaseRefusal } from '@comfyorg/account-core/billing'
import type { BillingEntry, EntryAutoTopUp } from '@comfyorg/billing-contract'
import { buildBillingEntryUrl } from '@comfyorg/billing-contract'
import type { TopupAutoTopUpSettings } from '@comfyorg/ingest-types'

import type { Recheck } from '@/checkout/checkoutPage'
import type { PayVerdict } from '@/checkout/payVerdict'
import { topupVerdictOf } from '@/checkout/payVerdict'
import type { PayChoice } from '@/composables/useFullPageCheckout'

const CARD_METHOD_TYPE = 'card'

/** Where a hosted top-up checkout returns; billing-web's own neutral page. */
export const TOPUP_RETURN_PATH = '/return/topup'

interface AutoTopUpDefaultCard {
  readonly brand: string
  readonly last4: string
}

type AutoTopUpConsentCard =
  | { readonly kind: 'default'; readonly card: AutoTopUpDefaultCard }
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown' }

/** What a top-up link's auto top-up consent names: the rule, the monthly limit, and the card it charges. */
export interface AutoTopUpConsent {
  readonly thresholdCredits: number
  readonly targetCredits: number
  /** The customer's own limit, else the ceiling served for no limit; undefined until that read lands. */
  readonly monthlyLimitCents: number | undefined
  readonly card: AutoTopUpConsentCard
}

const upperFirst = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1)

function consentCardOf(
  methods: readonly SavedPaymentMethod[] | undefined
): AutoTopUpConsentCard {
  if (methods === undefined) return { kind: 'unknown' }
  const card = methods.find((method) => method.is_default)
  if (card === undefined) return { kind: 'none' }
  return card.brand && card.last4
    ? {
        kind: 'default',
        card: { brand: upperFirst(card.brand), last4: card.last4 }
      }
    : { kind: 'unknown' }
}

/** `methods` is undefined until a saved-cards read succeeds. */
export function autoTopUpConsentOf(
  choice: EntryAutoTopUp,
  ceilingCents: number | undefined,
  methods: readonly SavedPaymentMethod[] | undefined
): AutoTopUpConsent {
  return {
    thresholdCredits: choice.thresholdCredits,
    targetCredits: choice.targetCredits,
    monthlyLimitCents: choice.monthlyBudgetCents ?? ceilingCents,
    card: consentCardOf(methods)
  }
}

/** The settings a hosted top-up sends; an absent limit stays absent, which the server stores as no limit. */
export function topupAutoTopUpOf(
  choice: EntryAutoTopUp
): TopupAutoTopUpSettings {
  return {
    threshold_credits: choice.thresholdCredits,
    target_credits: choice.targetCredits,
    ...(choice.monthlyBudgetCents === undefined
      ? {}
      : { monthly_budget_cents: choice.monthlyBudgetCents })
  }
}

const STATUSLESS_ANSWERS: ReadonlySet<string> = new Set([
  'NOT_AUTHENTICATED',
  'ACCESS_DENIED',
  'NOT_AVAILABLE',
  'NO_PAYMENT_METHOD',
  'INVALID_AMOUNT'
])

const CONFLICT = 409
const RATE_LIMITED = 429

/** The top-up page's own link, so a bank check that leaves the page comes back to the same workspace and amount. */
export function topupReturnUrl(
  arrival: BillingEntry,
  workspaceId: string | undefined,
  billingOrigin: string
): string | undefined {
  const built = buildBillingEntryUrl({
    billingOrigin,
    intent: 'top-up',
    product: arrival.product,
    returnTo: arrival.returnTo,
    ...(arrival.source === undefined ? {} : { source: arrival.source }),
    ...(arrival.amountCents === undefined
      ? {}
      : { amountCents: arrival.amountCents }),
    ...(arrival.autoTopUp === undefined
      ? {}
      : { autoTopUp: arrival.autoTopUp }),
    ...(workspaceId === undefined ? {} : { workspaceId })
  })
  return built.status === 'ok' ? built.url.href : undefined
}

/** The one authority a pay-once top-up sends; a new method that is not a card has none. */
export function interactivePaymentOf(
  choice: NonNullable<PayChoice>,
  returnUrl: string | undefined
): InteractiveTopupPayment | undefined {
  if ('savedMethodId' in choice)
    return { savedPaymentMethodId: choice.savedMethodId }
  if (choice.methodType !== CARD_METHOD_TYPE || returnUrl === undefined)
    return undefined
  return { confirmationToken: choice.confirmationToken, returnUrl }
}

/** Whether a Pay names the held purchase: the same saved card, or the card form again with its card still typed in. */
export function isSamePayment(
  held: InteractiveTopupPayment,
  next: InteractiveTopupPayment | undefined
): boolean {
  if (next === undefined) return false
  if ('savedPaymentMethodId' in held)
    return (
      'savedPaymentMethodId' in next &&
      held.savedPaymentMethodId === next.savedPaymentMethodId
    )
  return 'confirmationToken' in next && held.returnUrl === next.returnUrl
}

/**
 * Whether the server answered this purchase for good, so the next Pay is a
 * new purchase. A pending, conflicting, rate-limited, unanswered or 5xx
 * attempt is resent unchanged under its key; a purchase the server refuses
 * for now is answered.
 */
export function settlesAttempt(result: TopupResult): boolean {
  if (result.status === 'ok' || result.status === 'declined') return true
  if (result.status === 'unsettled') return false
  if ('serverCode' in result && isPurchaseRefusal(result)) return true
  if (!('httpStatus' in result) || result.httpStatus === undefined)
    return STATUSLESS_ANSWERS.has(result.code)
  const { httpStatus } = result
  return (
    httpStatus >= 400 &&
    httpStatus < 500 &&
    httpStatus !== CONFLICT &&
    httpStatus !== RATE_LIMITED
  )
}

/** A pay-once Pay the server never answered for good is re-read under its held key, never shown a card. */
export function interactiveVerdictOf(result: TopupResult): PayVerdict {
  if (result.status === 'unsettled') return rereads('unanswered')
  if (result.status !== 'error' || settlesAttempt(result))
    return topupVerdictOf(result)
  const httpStatus = 'httpStatus' in result ? result.httpStatus : undefined
  if (httpStatus === CONFLICT) return rereads(undefined)
  return rereads(httpStatus === RATE_LIMITED ? 'rate_limited' : 'unanswered')
}

function rereads(because: Recheck | undefined): PayVerdict {
  return {
    kind: 'outcome',
    outcome: {
      kind: 'reconciling',
      ...(because === undefined ? {} : { because })
    }
  }
}
