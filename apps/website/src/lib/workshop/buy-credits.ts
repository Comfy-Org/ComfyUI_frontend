import { z } from 'zod'

import {
  WORKSHOP_CLOUD_BASE_URL,
  WORKSHOP_CLOUD_ENV,
  WORKSHOP_CREDITS_URL
} from '../../config/workshop-env'

/**
 * The MVP rail (DES-1015): buying happens on platform.comfy.org, in a new
 * tab so the model page and its inputs stay alive. The workspace travels as
 * the server-resolved id — comfy.org and platform keep separate switchers,
 * and without it a buyer can top up the wallet that is not the empty one.
 * The parameter name is the shape agreed for platform's deep-link work, not
 * yet its confirmed contract.
 *
 * Platform billing exists only against production Cloud. The lower families
 * keep the visitor on their own cloud's credits page, so a preview can never
 * hand a staging workspace id to production billing.
 */
const PLATFORM_ORIGIN = 'https://platform.comfy.org'

export function platformTopUpHref(workspaceId?: string): string {
  if (WORKSHOP_CLOUD_ENV !== 'prod') return WORKSHOP_CREDITS_URL
  const url = new URL('/billing', PLATFORM_ORIGIN)
  if (workspaceId) url.searchParams.set('workspace', workspaceId)
  return url.toString()
}

/**
 * Hunter's universal top-up: `POST /api/billing/topup/checkout` on the
 * session's own Cloud creates a hosted Stripe Checkout session and answers
 * with its URL. Behind `topup_checkout_enabled` (dark rollout): a caller the
 * flag has not reached gets a 404, not a refusal — branch on it and fall
 * back rather than surfacing an error. The return address must be a host in
 * ingest's own allowlist, which today means Cloud itself, so the buyer
 * resurfaces on the cloud credits page and the model page re-reads its
 * balance on refocus.
 */
export class TopUpCheckoutError extends Error {
  constructor(readonly status: number) {
    super('Top-up checkout failed with status ' + String(status))
  }
}

const zTopUpCheckout = z.object({ checkout_url: z.string().url() })

export async function createTopUpCheckout(
  token: string,
  amountCents: number
): Promise<string> {
  const response = await fetch(
    new URL('/api/billing/topup/checkout', WORKSHOP_CLOUD_BASE_URL),
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount_cents: amountCents,
        return_url: WORKSHOP_CREDITS_URL
      })
    }
  )
  if (!response.ok) throw new TopUpCheckoutError(response.status)
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = zTopUpCheckout.safeParse(body)
  if (!parsed.success) throw new TopUpCheckoutError(response.status)
  return parsed.data.checkout_url
}
