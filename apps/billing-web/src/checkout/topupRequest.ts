import type {
  InteractiveTopupPayment,
  TopupResult
} from '@comfyorg/account-core/billing'
import type { BillingEntry } from '@comfyorg/billing-contract'
import { buildBillingEntryUrl } from '@comfyorg/billing-contract'

import type { PayChoice } from '@/composables/useFullPageCheckout'

const CARD_METHOD_TYPE = 'card'

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

/**
 * Whether the server answered this purchase for good, so the next Pay is a
 * new purchase. A pending, conflicting, rate-limited, unanswered or 5xx
 * attempt is resent unchanged under its key.
 */
export function settlesAttempt(result: TopupResult): boolean {
  if (result.status === 'ok' || result.status === 'declined') return true
  if (result.status === 'unsettled') return false
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
