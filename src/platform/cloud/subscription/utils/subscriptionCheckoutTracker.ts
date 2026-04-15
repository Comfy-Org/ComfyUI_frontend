import {
  TIER_TO_KEY,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  SubscriptionTier,
  TierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { SubscriptionSuccessMetadata } from '@/platform/telemetry/types'

const PENDING_SUBSCRIPTION_CHECKOUT_MAX_AGE_MS = 6 * 60 * 60 * 1000
const VALID_TIER_KEYS = new Set<TierKey>([
  'free',
  'standard',
  'creator',
  'pro',
  'founder'
])

export const PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY =
  'comfy.subscription.pending_checkout_attempt'
export const PENDING_SUBSCRIPTION_CHECKOUT_EVENT =
  'comfy:subscription-checkout-attempt-changed'

type CheckoutType = 'new' | 'change'
type SubscriptionDuration = 'MONTHLY' | 'ANNUAL'

interface SubscriptionStatusSnapshot {
  is_active?: boolean
  subscription_tier?: SubscriptionTier | null
  subscription_duration?: SubscriptionDuration | null
}

interface PendingSubscriptionCheckoutAttempt {
  attempt_id: string
  started_at_ms: number
  tier: TierKey
  cycle: BillingCycle
  checkout_type: CheckoutType
  previous_tier?: TierKey
  previous_cycle?: BillingCycle
}

interface RecordPendingSubscriptionCheckoutAttemptInput {
  tier: TierKey
  cycle: BillingCycle
  checkout_type: CheckoutType
  previous_tier?: TierKey
  previous_cycle?: BillingCycle
}

const dispatchPendingCheckoutChangeEvent = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(PENDING_SUBSCRIPTION_CHECKOUT_EVENT))
}

const createAttemptId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `attempt-${Date.now()}`
}

const getStorage = (): Storage | null => {
  const storage = globalThis.localStorage

  if (
    !storage ||
    typeof storage.getItem !== 'function' ||
    typeof storage.setItem !== 'function' ||
    typeof storage.removeItem !== 'function'
  ) {
    return null
  }

  return storage
}

const getAnnualCheckoutValue = (tier: Exclude<TierKey, 'free' | 'founder'>) =>
  getTierPrice(tier, true) * 12

const getCheckoutValue = (tier: TierKey, cycle: BillingCycle): number => {
  if (tier === 'free' || tier === 'founder') {
    return getTierPrice(tier, cycle === 'yearly')
  }

  return cycle === 'yearly'
    ? getAnnualCheckoutValue(tier)
    : getTierPrice(tier, false)
}

const getTierFromStatus = (
  status: SubscriptionStatusSnapshot
): TierKey | null => {
  const subscriptionTier = status.subscription_tier
  if (!subscriptionTier) {
    return null
  }

  return TIER_TO_KEY[subscriptionTier] ?? null
}

const getCycleFromStatus = (
  status: SubscriptionStatusSnapshot
): BillingCycle | null => {
  if (status.subscription_duration === 'ANNUAL') {
    return 'yearly'
  }

  if (status.subscription_duration === 'MONTHLY') {
    return 'monthly'
  }

  return null
}

const isExpired = (attempt: PendingSubscriptionCheckoutAttempt): boolean =>
  Date.now() - attempt.started_at_ms > PENDING_SUBSCRIPTION_CHECKOUT_MAX_AGE_MS

const normalizeAttempt = (
  value: unknown
): PendingSubscriptionCheckoutAttempt | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PendingSubscriptionCheckoutAttempt>

  if (
    typeof candidate.attempt_id !== 'string' ||
    typeof candidate.started_at_ms !== 'number' ||
    typeof candidate.tier !== 'string' ||
    typeof candidate.cycle !== 'string' ||
    typeof candidate.checkout_type !== 'string'
  ) {
    return null
  }

  if (
    !VALID_TIER_KEYS.has(candidate.tier as TierKey) ||
    (candidate.cycle !== 'monthly' && candidate.cycle !== 'yearly') ||
    (candidate.checkout_type !== 'new' && candidate.checkout_type !== 'change')
  ) {
    return null
  }

  return {
    attempt_id: candidate.attempt_id,
    started_at_ms: candidate.started_at_ms,
    tier: candidate.tier as TierKey,
    cycle: candidate.cycle,
    checkout_type: candidate.checkout_type,
    ...(candidate.previous_tier &&
    VALID_TIER_KEYS.has(candidate.previous_tier as TierKey)
      ? { previous_tier: candidate.previous_tier as TierKey }
      : {}),
    ...(candidate.previous_cycle === 'monthly' ||
    candidate.previous_cycle === 'yearly'
      ? { previous_cycle: candidate.previous_cycle }
      : {})
  }
}

const clearPendingSubscriptionCheckoutAttempt = (): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.removeItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
  dispatchPendingCheckoutChangeEvent()
}

const getPendingSubscriptionCheckoutAttempt =
  (): PendingSubscriptionCheckoutAttempt | null => {
    const storage = getStorage()
    if (!storage) {
      return null
    }

    const rawAttempt = storage.getItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
    )

    if (!rawAttempt) {
      return null
    }

    try {
      const parsed = JSON.parse(rawAttempt)
      const attempt = normalizeAttempt(parsed)

      if (!attempt || isExpired(attempt)) {
        clearPendingSubscriptionCheckoutAttempt()
        return null
      }

      return attempt
    } catch {
      clearPendingSubscriptionCheckoutAttempt()
      return null
    }
  }

export const hasPendingSubscriptionCheckoutAttempt = (): boolean =>
  getPendingSubscriptionCheckoutAttempt() !== null

export const recordPendingSubscriptionCheckoutAttempt = (
  input: RecordPendingSubscriptionCheckoutAttemptInput
): PendingSubscriptionCheckoutAttempt => {
  const storage = getStorage()
  if (!storage) {
    return {
      attempt_id: createAttemptId(),
      started_at_ms: Date.now(),
      tier: input.tier,
      cycle: input.cycle,
      checkout_type: input.checkout_type,
      ...(input.previous_tier ? { previous_tier: input.previous_tier } : {}),
      ...(input.previous_cycle ? { previous_cycle: input.previous_cycle } : {})
    }
  }

  const attempt: PendingSubscriptionCheckoutAttempt = {
    attempt_id: createAttemptId(),
    started_at_ms: Date.now(),
    tier: input.tier,
    cycle: input.cycle,
    checkout_type: input.checkout_type,
    ...(input.previous_tier ? { previous_tier: input.previous_tier } : {}),
    ...(input.previous_cycle ? { previous_cycle: input.previous_cycle } : {})
  }

  storage.setItem(
    PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
    JSON.stringify(attempt)
  )
  dispatchPendingCheckoutChangeEvent()

  return attempt
}

const didAttemptSucceed = (
  attempt: PendingSubscriptionCheckoutAttempt,
  status: SubscriptionStatusSnapshot
): boolean => {
  if (!status.is_active) {
    return false
  }

  return (
    getTierFromStatus(status) === attempt.tier &&
    getCycleFromStatus(status) === attempt.cycle
  )
}

export const consumePendingSubscriptionCheckoutSuccess = (
  status: SubscriptionStatusSnapshot
): SubscriptionSuccessMetadata | null => {
  const attempt = getPendingSubscriptionCheckoutAttempt()
  if (!attempt || !didAttemptSucceed(attempt, status)) {
    return null
  }

  clearPendingSubscriptionCheckoutAttempt()

  const value = getCheckoutValue(attempt.tier, attempt.cycle)

  return {
    checkout_attempt_id: attempt.attempt_id,
    tier: attempt.tier,
    cycle: attempt.cycle,
    checkout_type: attempt.checkout_type,
    ...(attempt.previous_tier ? { previous_tier: attempt.previous_tier } : {}),
    value,
    currency: 'USD',
    ecommerce: {
      value,
      currency: 'USD',
      items: [
        {
          item_name: attempt.tier,
          item_category: 'subscription',
          item_variant: attempt.cycle,
          price: value,
          quantity: 1
        }
      ]
    }
  }
}
