import { z } from 'zod'

import { zErrorResponse } from '@comfyorg/ingest-types/zod'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'

export class TopUpCheckoutError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super('Top-up checkout failed with status ' + String(status))
  }
}

// Stripe serves the hosted Checkout page from its default host or from an
// account's configured custom checkout domain. The Comfy Stripe account uses
// checkout.comfy.org in every environment, so both are trusted destinations.
const CHECKOUT_HOSTS = new Set(['checkout.stripe.com', 'checkout.comfy.org'])

const zTopUpCheckout = z.object({
  checkout_url: z
    .string()
    .url()
    .refine((raw) => {
      try {
        const url = new URL(raw)
        return (
          url.protocol === 'https:' &&
          CHECKOUT_HOSTS.has(url.hostname) &&
          url.port === '' &&
          url.username === '' &&
          url.password === ''
        )
      } catch {
        return false
      }
    }, 'checkout_url must be a Stripe-hosted HTTPS URL'),
  session_id: z.string().optional()
})

export interface TopUpCheckoutSession {
  readonly url: string
  readonly sessionId?: string
}

export interface CreateTopUpCheckoutOptions {
  readonly token: string
  readonly amountCents: number
  readonly returnUrl: string
  readonly idempotencyKey: string
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export async function createTopUpCheckout(
  options: CreateTopUpCheckoutOptions
): Promise<TopUpCheckoutSession> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout
  const response = await fetch(
    new URL('/api/billing/topup/checkout', WORKSHOP_CLOUD_BASE_URL),
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + options.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount_cents: options.amountCents,
        return_url: options.returnUrl,
        idempotency_key: options.idempotencyKey
      }),
      signal
    }
  )
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const parsedError = zErrorResponse.safeParse(body)
    throw new TopUpCheckoutError(
      response.status,
      parsedError.success ? parsedError.data.code : undefined
    )
  }
  const parsed = zTopUpCheckout.safeParse(body)
  if (!parsed.success)
    throw new TopUpCheckoutError(response.status, 'INVALID_RESPONSE')
  return {
    url: parsed.data.checkout_url,
    ...(parsed.data.session_id !== undefined
      ? { sessionId: parsed.data.session_id }
      : {})
  }
}
