/**
 * The subscribe request both checkouts (the hosted M2 view and the
 * full-page M1 shell) assemble identically: where a hosted continuation
 * sends the customer back, and the body `checkout.subscribe` posts.
 */
import type {
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import type { BillingEntry } from '@comfyorg/billing-contract'
import { buildBillingEntryUrl } from '@comfyorg/billing-contract'

/** Where a hosted payment step sends the customer back: this origin, same request. */
export function checkoutResultUrl(
  arrival: BillingEntry,
  workspaceId: string | undefined,
  billingOrigin: string
): string | undefined {
  const built = buildBillingEntryUrl({
    billingOrigin,
    intent: 'result',
    product: arrival.product,
    returnTo: arrival.returnTo,
    ...(arrival.plan === undefined ? {} : { plan: arrival.plan }),
    ...(arrival.teamCreditStopId === undefined
      ? {}
      : { teamCreditStopId: arrival.teamCreditStopId }),
    ...(workspaceId === undefined ? {} : { workspaceId })
  })
  return built.status === 'ok' ? built.url.href : undefined
}

export function buildSubscribeRequest({
  arrival,
  plan,
  quoted,
  confirmationToken,
  savedPaymentMethodId,
  confirmReactivation,
  returnUrl
}: {
  arrival: BillingEntry
  plan: string
  quoted: SubscriptionPreview
  confirmationToken: string | undefined
  savedPaymentMethodId?: string
  confirmReactivation: boolean
  returnUrl: string | undefined
}): SubscribeInput {
  return {
    plan_slug: plan,
    ...(confirmationToken === undefined
      ? {}
      : { confirmation_token: confirmationToken }),
    ...(savedPaymentMethodId === undefined
      ? {}
      : { saved_payment_method_id: savedPaymentMethodId }),
    ...(arrival.teamCreditStopId === undefined
      ? {}
      : { team_credit_stop_id: arrival.teamCreditStopId }),
    ...(quoted.quote_id === undefined ? {} : { quote_id: quoted.quote_id }),
    ...(quoted.quote_version === undefined
      ? {}
      : { quote_version: quoted.quote_version }),
    ...(quoted.is_immediate && quoted.proration_at !== undefined
      ? { proration_at: quoted.proration_at }
      : {}),
    ...(returnUrl === undefined ? {} : { return_url: returnUrl }),
    ...(confirmReactivation ? { confirm_reactivation: true } : {})
  }
}
