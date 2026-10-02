/**
 * The host's subscribe options as the generated request body, field for field,
 * including the two the workspace client drops when they arrive empty: JSON
 * keeps `''`, so an empty credential would reach the server as present but
 * meaningless.
 *
 * `SubscribeOptions` carries nothing the generated body lacks. `SubscribeInput`
 * also has `checkout_attempt_id` and `idempotency_key`, which no host caller
 * sets: the SDK mints the key itself, and the checkout attempt is carried on
 * the quote rather than the subscribe.
 *
 * Shared so the two call sites that issue a subscribe on the rail — the
 * workspace billing adapter and the team deep-link checkout — send one body.
 */
import type { SubscribeInput } from '@comfyorg/account-core/billing'

import type { SubscribeOptions } from '@/platform/workspace/api/workspaceApi'

export function subscribeInputFrom(
  planSlug: string,
  options: SubscribeOptions = {}
): SubscribeInput {
  return {
    plan_slug: planSlug,
    confirmation_token: options.confirmationToken || undefined,
    saved_payment_method_id: options.savedPaymentMethodId || undefined,
    promotion_code: options.promotionCode,
    quote_id: options.quoteId,
    quote_version: options.quoteVersion,
    return_url: options.returnUrl,
    cancel_url: options.cancelUrl,
    team_credit_stop_id: options.teamCreditStopId,
    billing_cycle: options.billingCycle,
    confirm_reactivation: options.confirmReactivation,
    proration_at: options.prorationAt
  }
}
