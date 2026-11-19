import type { InteractiveTopupPayment } from '@comfyorg/account-core/billing'

const STORAGE_KEY = 'comfy.billing-web.topup-attempt.v1'
const PROBE_KEY = 'comfy.billing-web.topup-attempt.probe'

/** A pay-once purchase sent under its key and not yet answered for good. */
export interface HeldTopupAttempt {
  readonly payment: InteractiveTopupPayment
  readonly idempotencyKey: string
}

interface StoredTopupAttempt extends HeldTopupAttempt {
  readonly request: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function paymentOf(value: unknown): InteractiveTopupPayment | undefined {
  if (!isRecord(value)) return undefined
  const { savedPaymentMethodId, confirmationToken, returnUrl } = value
  if (typeof savedPaymentMethodId === 'string') return { savedPaymentMethodId }
  if (typeof confirmationToken === 'string' && typeof returnUrl === 'string')
    return { confirmationToken, returnUrl }
  return undefined
}

function storedAttemptOf(raw: string | null): StoredTopupAttempt | undefined {
  if (raw === null) return undefined
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value)) return undefined
  const { request, idempotencyKey } = value
  const payment = paymentOf(value.payment)
  if (
    typeof request !== 'string' ||
    typeof idempotencyKey !== 'string' ||
    payment === undefined
  )
    return undefined
  return { request, idempotencyKey, payment }
}

/** Whether this tab can keep an unanswered purchase through a reload. */
export function canHoldTopupAttempt(): boolean {
  try {
    globalThis.sessionStorage.setItem(PROBE_KEY, '1')
    globalThis.sessionStorage.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}

/** Keeps `attempt` for this tab's purchase `request` until it is released. */
export function holdTopupAttempt(
  request: string,
  attempt: HeldTopupAttempt
): void {
  const stored: StoredTopupAttempt = { request, ...attempt }
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    return
  }
}

/** The attempt this tab still holds for `request`, if any. */
export function heldTopupAttempt(
  request: string
): HeldTopupAttempt | undefined {
  try {
    const stored = storedAttemptOf(
      globalThis.sessionStorage.getItem(STORAGE_KEY)
    )
    return stored?.request === request
      ? { payment: stored.payment, idempotencyKey: stored.idempotencyKey }
      : undefined
  } catch {
    return undefined
  }
}

/** Drops the held attempt once the server answered the purchase under `idempotencyKey` for good. */
export function releaseTopupAttempt(idempotencyKey: string): void {
  try {
    const stored = storedAttemptOf(
      globalThis.sessionStorage.getItem(STORAGE_KEY)
    )
    if (stored?.idempotencyKey === idempotencyKey)
      globalThis.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}
