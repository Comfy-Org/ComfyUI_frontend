/**
 * Where a Workshop top-up checkout comes from: the billing SDK's hosted
 * command once `billing_sdk_topup_enabled` is on and the route is deployed,
 * and the site's own request otherwise. Both answer with the same session
 * shape and the same `TopUpCheckoutError`, so the dialog's tab claim, return
 * announce, and balance watch are untouched either way.
 */
import type { HostedTopupCheckoutFailure } from '@comfyorg/account/billing'

import { workshopTopupCommand } from '../../config/workshop-billing-sdk'
import { readBillingSdkTopupEnabled } from '../../config/workshop-features'
import type {
  CreateTopUpCheckoutOptions,
  TopUpCheckoutSession
} from './buy-credits'
import {
  TopUpCheckoutError,
  createTopUpCheckout,
  isStripeHostedCheckoutUrl,
  topUpCheckoutReturnUrl
} from './buy-credits'

/** The SDK answers with a session, not a response; a rejected URL is a body failure on the 200. */
const CHECKOUT_BODY_STATUS = 200
/** A failure the SDK decided before any response landed carries no HTTP status. */
const NO_HTTP_STATUS = 0

function httpStatusOf(failure: HostedTopupCheckoutFailure): number {
  return 'httpStatus' in failure
    ? (failure.httpStatus ?? NO_HTTP_STATUS)
    : NO_HTTP_STATUS
}

/** Undefined is the flag-gated 404: the route is not deployed, so the legacy request stands. */
async function hostedCheckout(
  options: CreateTopUpCheckoutOptions
): Promise<TopUpCheckoutSession | undefined> {
  // The idempotency key is the command's own — the attempt id only correlates
  // the return announce — so a re-mint replays the same request.
  const result = await workshopTopupCommand().createHostedTopupCheckout({
    amountCents: options.amountCents,
    returnUrl: topUpCheckoutReturnUrl(options),
    ...(options.signal === undefined ? {} : { signal: options.signal })
  })
  if (result.status === 'error') {
    if (result.code === 'NOT_AVAILABLE') return undefined
    throw new TopUpCheckoutError(httpStatusOf(result), result.code)
  }
  if (!isStripeHostedCheckoutUrl(result.url)) {
    throw new TopUpCheckoutError(CHECKOUT_BODY_STATUS, 'INVALID_RESPONSE')
  }
  return {
    url: result.url,
    ...(result.sessionId === undefined ? {} : { sessionId: result.sessionId })
  }
}

export async function createWorkshopTopUpCheckout(
  options: CreateTopUpCheckoutOptions
): Promise<TopUpCheckoutSession> {
  if (!(await readBillingSdkTopupEnabled())) {
    return createTopUpCheckout(options)
  }
  return (await hostedCheckout(options)) ?? createTopUpCheckout(options)
}
