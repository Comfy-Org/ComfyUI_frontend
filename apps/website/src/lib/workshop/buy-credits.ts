import { z } from 'zod'

import { zErrorResponse } from '@comfyorg/ingest-types/zod'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_CREDITS_URL
} from '../../config/workshop-env'
import type { Locale } from '../../i18n/translations'
import {
  combineAbortSignals,
  createTimeoutSignal
} from '../../utils/abortSignal'
import { topUpReturnUrl } from './topup-return'

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

export function isStripeHostedCheckoutUrl(raw: string): boolean {
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
}

const zTopUpCheckout = z.object({
  checkout_url: z
    .string()
    .url()
    .refine(
      isStripeHostedCheckoutUrl,
      'checkout_url must be a Stripe-hosted HTTPS URL'
    ),
  session_id: z.string().optional()
})

export interface TopUpCheckoutSession {
  readonly url: string
  readonly sessionId?: string
}

export interface CreateTopUpCheckoutOptions {
  readonly token: string
  readonly amountCents: number
  readonly idempotencyKey: string
  readonly locale?: Locale
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export function topUpCheckoutReturnUrl(
  options: Pick<CreateTopUpCheckoutOptions, 'locale' | 'idempotencyKey'>
): string {
  if (typeof window === 'undefined') return WORKSHOP_CREDITS_URL
  const returnPath =
    options.locale === 'zh-CN' ? '/zh-CN/checkout-return' : '/checkout-return'
  return topUpReturnUrl(
    new URL(returnPath, window.location.origin).toString(),
    options.idempotencyKey
  )
}

async function requestTopUpCheckout(
  options: CreateTopUpCheckoutOptions,
  returnUrl: string,
  signal: AbortSignal
): Promise<TopUpCheckoutSession> {
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
        return_url: returnUrl,
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

export async function createTopUpCheckout(
  options: CreateTopUpCheckoutOptions
): Promise<TopUpCheckoutSession> {
  const timeout = createTimeoutSignal(options.timeoutMs ?? 15_000)
  const signal = options.signal
    ? combineAbortSignals([options.signal, timeout])
    : timeout
  const ownReturnUrl = topUpCheckoutReturnUrl(options)
  try {
    return await requestTopUpCheckout(options, ownReturnUrl, signal)
  } catch (error) {
    if (
      ownReturnUrl !== WORKSHOP_CREDITS_URL &&
      error instanceof TopUpCheckoutError &&
      error.status === 404
    ) {
      return requestTopUpCheckout(options, WORKSHOP_CREDITS_URL, signal)
    }
    throw error
  }
}
