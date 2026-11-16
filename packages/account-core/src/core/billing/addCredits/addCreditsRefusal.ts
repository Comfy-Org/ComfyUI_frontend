import { matchesServerCode } from '#/core/billing/billingContracts'
import type { CapabilityDenialReason } from '#/core/billing/capabilityDenials'
import type { HostedTopupCheckoutFailure } from '#/core/billing/topup'

/** Why the server would not open a checkout; each kind has its own notice copy. */
export type AddCreditsRefusal =
  | { readonly kind: 'rate_limited'; readonly retryAfterSeconds?: number }
  | { readonly kind: 'purchases_paused' }
  | { readonly kind: 'not_allowed' }
  | { readonly kind: 'checkout_failed' }

export type AddCreditsWait =
  | { readonly unit: 'later' }
  | { readonly unit: 'minute' | 'hour' | 'day'; readonly count: number }

const RATE_LIMITED = 'TOPUP_RATE_LIMITED'
const PURCHASES_PAUSED = 'TOPUP_PURCHASES_PAUSED'
const PURCHASES_PAUSED_DENIAL: CapabilityDenialReason = 'topup_purchases_paused'

/** Maps a failed checkout to its notice; codes the dialog does not know read as "couldn't open checkout". */
export function addCreditsRefusalFor(
  failure: HostedTopupCheckoutFailure
): AddCreditsRefusal {
  if ('serverCode' in failure && matchesServerCode(failure, RATE_LIMITED)) {
    return failure.retryAfterSeconds === undefined
      ? { kind: 'rate_limited' }
      : { kind: 'rate_limited', retryAfterSeconds: failure.retryAfterSeconds }
  }
  if ('serverCode' in failure && matchesServerCode(failure, PURCHASES_PAUSED)) {
    return { kind: 'purchases_paused' }
  }
  if (failure.code === 'ACCESS_DENIED') {
    return addCreditsRefusalForDenial(
      'denial' in failure ? failure.denial : undefined
    )
  }
  return { kind: 'checkout_failed' }
}

/** The served `can_top_up` refusal the dialog shows while it is open. */
export function addCreditsRefusalForDenial(
  denial: CapabilityDenialReason | undefined
): AddCreditsRefusal {
  return denial === PURCHASES_PAUSED_DENIAL
    ? { kind: 'purchases_paused' }
    : { kind: 'not_allowed' }
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** `Retry-After` seconds rounded up to the coarsest whole unit that still reads naturally. */
export function addCreditsWait(seconds: number | undefined): AddCreditsWait {
  if (seconds === undefined || seconds <= 0) return { unit: 'later' }
  if (seconds < HOUR) {
    return { unit: 'minute', count: Math.max(1, Math.ceil(seconds / MINUTE)) }
  }
  if (seconds < DAY) return { unit: 'hour', count: Math.ceil(seconds / HOUR) }
  return { unit: 'day', count: Math.ceil(seconds / DAY) }
}
