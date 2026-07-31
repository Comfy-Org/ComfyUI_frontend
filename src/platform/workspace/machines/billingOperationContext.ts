export const INITIAL_INTERVAL_MS = 1000
export const MAX_INTERVAL_MS = 8000
export const ACTION_REQUIRED_INTERVAL_MS = 30_000
export const BACKOFF_MULTIPLIER = 1.5
export const TIMEOUT_MS = 120_000
export const SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS = 5 * 60_000
export const SUBSCRIPTION_AUTHENTICATION_TIMEOUT_MS = 23 * 60 * 60_000

export type BillingOperationType = 'subscription' | 'topup' | 'cancel'

export interface BillingOperationContext {
  opId: string
  type: BillingOperationType
  workspaceId: string | null
  startedAt: number
  intervalMs: number
  actionUrl: string | null
  authenticationRequiredSeen: boolean
  backendErrorMessage: string | null
  /**
   * Injected so the budget can be driven without fake timers. Production
   * passes Date.now.
   */
  readNow: () => number
}

export interface BillingOperationInput {
  opId: string
  type: BillingOperationType
  workspaceId: string | null
  startedAt: number
  initialActionUrl?: string
  readNow?: () => number
}

/**
 * Only https action URLs are surfaced. Anything else is discarded rather than
 * shown, so a downgraded scheme cannot be presented as a payment link.
 */
export function validateActionUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}
