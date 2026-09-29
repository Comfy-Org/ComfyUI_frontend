import type { SubscriptionDuration } from '@comfyorg/ingest-types'
import {
  getTierPrice,
  toTierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  IngestSubscriptionTier,
  TierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type {
  BeginCheckoutMetadata,
  PaymentIntentSource,
  ResubscribeClickMetadata,
  SubscriptionCheckoutType,
  SubscriptionSuccessMetadata
} from '@/platform/telemetry/types'

const PENDING_SUBSCRIPTION_CHECKOUT_MAX_AGE_MS = 6 * 60 * 60 * 1000
const PENDING_SUBSCRIPTION_CHECKOUT_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000
const VALID_TIER_KEYS: ReadonlySet<string> = new Set([
  'free',
  'standard',
  'creator',
  'pro',
  'founder'
])
const VALID_PAYMENT_INTENT_SOURCES = {
  subscription_required: true,
  out_of_credits: true,
  top_up_blocked: true,
  deep_link: true,
  subscribe_to_run: true,
  subscribe_now_button: true,
  upgrade_to_add_credits: true,
  settings_billing_panel: true,
  avatar_menu_plans: true,
  team_members_panel: true,
  invite_member_upsell: true,
  upload_model_upgrade: true,
  team_upgrade_resume: true,
  free_tier_quota: true,
  agent_paywall: true
} satisfies Record<PaymentIntentSource, true>

export const PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY =
  'comfy.subscription.pending_checkout_attempt'
export const PENDING_SUBSCRIPTION_CHECKOUT_EVENT =
  'comfy:subscription-checkout-attempt-changed'
const PENDING_SUBSCRIPTION_CHECKOUT_TERMINAL_STORAGE_KEY =
  'comfy.subscription.pending_checkout_terminal'

export type PendingCheckoutTerminal =
  | 'completion_missing'
  | 'recovery_unreachable'

interface PendingCheckoutTerminalClaim {
  attempt_id: string
  terminal: PendingCheckoutTerminal
}

interface SubscriptionStatusSnapshot {
  is_active?: boolean
  subscription_tier?: IngestSubscriptionTier | null
  subscription_duration?: SubscriptionDuration | null
  cancel_at?: string | null
}

export interface PendingSubscriptionCheckoutAttempt {
  attempt_id: string
  started_at_ms: number
  tier: TierKey
  cycle: BillingCycle
  checkout_type: SubscriptionCheckoutType
  previous_tier?: TierKey
  previous_cycle?: BillingCycle
  /** Cancellation marker observed before a resubscribe checkout opened. */
  previous_cancel_at?: string | null
  payment_intent_source?: PaymentIntentSource
  /** Set when this attempt was initiated from the resubscribe flow, not a plain subscribe. */
  operation?: 'resubscribe'
  /** Click-time source for a resubscribe attempt; carried through to the terminal event. */
  resubscribe_source?: ResubscribeClickMetadata['source']
  /** User and workspace that opened checkout, used to reject another session's attempt. */
  owner_id?: string
  workspace_id?: string | null
}

interface PendingSubscriptionCheckoutAttemptInput {
  tier: TierKey
  cycle: BillingCycle
  checkout_type: SubscriptionCheckoutType
  previous_tier?: TierKey
  previous_cycle?: BillingCycle
  previous_cancel_at?: string | null
  payment_intent_source?: PaymentIntentSource
  operation?: 'resubscribe'
  resubscribe_source?: ResubscribeClickMetadata['source']
  owner_id?: string
  workspace_id?: string | null
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

type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const getStorage = (): CheckoutStorage | null => {
  let storage: unknown

  try {
    storage = globalThis.localStorage
  } catch {
    return null
  }

  return isCheckoutStorage(storage) ? storage : null
}

function isCheckoutStorage(value: unknown): value is CheckoutStorage {
  return (
    !!value &&
    typeof value === 'object' &&
    'getItem' in value &&
    typeof value.getItem === 'function' &&
    'setItem' in value &&
    typeof value.setItem === 'function' &&
    'removeItem' in value &&
    typeof value.removeItem === 'function'
  )
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
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

  return toTierKey(subscriptionTier)
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

const isCheckoutAttemptCore = (
  value: Record<string, unknown>
): value is Record<string, unknown> & {
  attempt_id: string
  started_at_ms: number
  tier: TierKey
  cycle: BillingCycle
  checkout_type: SubscriptionCheckoutType
} =>
  typeof value.attempt_id === 'string' &&
  typeof value.started_at_ms === 'number' &&
  Number.isFinite(value.started_at_ms) &&
  value.started_at_ms <=
    Date.now() + PENDING_SUBSCRIPTION_CHECKOUT_MAX_FUTURE_SKEW_MS &&
  isTierKey(value.tier) &&
  (value.cycle === 'monthly' || value.cycle === 'yearly') &&
  (value.checkout_type === 'new' || value.checkout_type === 'change')

const optionalCheckoutAttemptFields = (
  candidate: Record<string, unknown>
): Partial<PendingSubscriptionCheckoutAttempt> => ({
  ...(isTierKey(candidate.previous_tier)
    ? { previous_tier: candidate.previous_tier }
    : {}),
  ...(candidate.previous_cycle === 'monthly' ||
  candidate.previous_cycle === 'yearly'
    ? { previous_cycle: candidate.previous_cycle }
    : {}),
  ...(typeof candidate.previous_cancel_at === 'string' ||
  candidate.previous_cancel_at === null
    ? { previous_cancel_at: candidate.previous_cancel_at }
    : {}),
  ...(isPaymentIntentSource(candidate.payment_intent_source)
    ? { payment_intent_source: candidate.payment_intent_source }
    : {}),
  ...(candidate.operation === 'resubscribe'
    ? { operation: 'resubscribe' }
    : {}),
  ...(candidate.resubscribe_source === 'pricing_dialog' ||
  candidate.resubscribe_source === 'settings_billing_panel'
    ? { resubscribe_source: candidate.resubscribe_source }
    : {}),
  ...(typeof candidate.owner_id === 'string'
    ? { owner_id: candidate.owner_id }
    : {}),
  ...(typeof candidate.workspace_id === 'string' ||
  candidate.workspace_id === null
    ? { workspace_id: candidate.workspace_id }
    : {})
})

const normalizeAttempt = (
  value: unknown
): PendingSubscriptionCheckoutAttempt | null => {
  if (!isUnknownRecord(value) || !isCheckoutAttemptCore(value)) return null

  return {
    attempt_id: value.attempt_id,
    started_at_ms: Math.min(value.started_at_ms, Date.now()),
    tier: value.tier,
    cycle: value.cycle,
    checkout_type: value.checkout_type,
    ...optionalCheckoutAttemptFields(value)
  }
}

const isTierKey = (value: unknown): value is TierKey =>
  typeof value === 'string' && VALID_TIER_KEYS.has(value)

const isPaymentIntentSource = (value: unknown): value is PaymentIntentSource =>
  typeof value === 'string' &&
  Object.hasOwn(VALID_PAYMENT_INTENT_SOURCES, value)

export const clearPendingSubscriptionCheckoutAttempt = (): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
    storage.removeItem(PENDING_SUBSCRIPTION_CHECKOUT_TERMINAL_STORAGE_KEY)
  } catch {
    return
  }
  dispatchPendingCheckoutChangeEvent()
}

const persistClampedStartTime = (
  storage: CheckoutStorage,
  attempt: PendingSubscriptionCheckoutAttempt
) => {
  try {
    storage.setItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
      JSON.stringify(attempt)
    )
  } catch {
    return
  }
}

export const getPendingSubscriptionCheckoutAttempt =
  (): PendingSubscriptionCheckoutAttempt | null => {
    const storage = getStorage()
    if (!storage) {
      return null
    }

    let rawAttempt: string | null

    try {
      rawAttempt = storage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
    } catch {
      return null
    }

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

      if (
        isUnknownRecord(parsed) &&
        parsed.started_at_ms !== attempt.started_at_ms
      ) {
        persistClampedStartTime(storage, attempt)
      }

      return attempt
    } catch {
      clearPendingSubscriptionCheckoutAttempt()
      return null
    }
  }

const isPendingCheckoutTerminal = (
  value: unknown
): value is PendingCheckoutTerminal =>
  value === 'completion_missing' || value === 'recovery_unreachable'

const parsePendingCheckoutTerminalClaim = (
  rawClaim: string
): PendingCheckoutTerminalClaim | null => {
  try {
    const value: unknown = JSON.parse(rawClaim)
    if (
      !isUnknownRecord(value) ||
      typeof value.attempt_id !== 'string' ||
      !isPendingCheckoutTerminal(value.terminal)
    ) {
      return null
    }
    return { attempt_id: value.attempt_id, terminal: value.terminal }
  } catch {
    return null
  }
}

export const getPendingCheckoutTerminal = (
  attemptId: string
): PendingCheckoutTerminal | null => {
  try {
    const rawClaim = getStorage()?.getItem(
      PENDING_SUBSCRIPTION_CHECKOUT_TERMINAL_STORAGE_KEY
    )
    if (!rawClaim) return null
    const claim = parsePendingCheckoutTerminalClaim(rawClaim)
    return claim?.attempt_id === attemptId ? claim.terminal : null
  } catch {
    return null
  }
}

export const claimPendingCheckoutTerminal = (
  attemptId: string,
  terminal: PendingCheckoutTerminal
): PendingSubscriptionCheckoutAttempt | null => {
  const attempt = getPendingSubscriptionCheckoutAttempt()
  if (
    attempt?.attempt_id !== attemptId ||
    getPendingCheckoutTerminal(attemptId)
  ) {
    return null
  }

  try {
    getStorage()?.setItem(
      PENDING_SUBSCRIPTION_CHECKOUT_TERMINAL_STORAGE_KEY,
      JSON.stringify({ attempt_id: attemptId, terminal })
    )
  } catch {
    return null
  }

  return getPendingCheckoutTerminal(attemptId) === terminal ? attempt : null
}

export const hasPendingSubscriptionCheckoutAttempt = (): boolean =>
  getPendingSubscriptionCheckoutAttempt() !== null

export const createPendingSubscriptionCheckoutAttempt = (
  input: PendingSubscriptionCheckoutAttemptInput
): PendingSubscriptionCheckoutAttempt => {
  return {
    attempt_id: createAttemptId(),
    started_at_ms: Date.now(),
    tier: input.tier,
    cycle: input.cycle,
    checkout_type: input.checkout_type,
    ...(input.previous_tier ? { previous_tier: input.previous_tier } : {}),
    ...(input.previous_cycle ? { previous_cycle: input.previous_cycle } : {}),
    ...(input.previous_cancel_at !== undefined
      ? { previous_cancel_at: input.previous_cancel_at }
      : {}),
    ...(input.payment_intent_source
      ? { payment_intent_source: input.payment_intent_source }
      : {}),
    ...(input.operation ? { operation: input.operation } : {}),
    ...(input.resubscribe_source
      ? { resubscribe_source: input.resubscribe_source }
      : {}),
    ...(input.owner_id ? { owner_id: input.owner_id } : {}),
    ...(input.workspace_id !== undefined
      ? { workspace_id: input.workspace_id }
      : {})
  }
}

export const persistPendingSubscriptionCheckoutAttempt = (
  attempt: PendingSubscriptionCheckoutAttempt
): PendingSubscriptionCheckoutAttempt => {
  const storage = getStorage()
  if (!storage) {
    return attempt
  }

  try {
    storage.setItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
      JSON.stringify(attempt)
    )
  } catch {
    return attempt
  }
  dispatchPendingCheckoutChangeEvent()

  return attempt
}

export const recordPendingSubscriptionCheckoutAttempt = (
  input: PendingSubscriptionCheckoutAttemptInput
): PendingSubscriptionCheckoutAttempt =>
  persistPendingSubscriptionCheckoutAttempt(
    createPendingSubscriptionCheckoutAttempt(input)
  )

export const withPendingCheckoutAttemptId = (
  metadata: BeginCheckoutMetadata,
  attempt: PendingSubscriptionCheckoutAttempt
): BeginCheckoutMetadata => ({
  ...metadata,
  checkout_attempt_id: attempt.attempt_id
})

const didAttemptSucceed = (
  attempt: PendingSubscriptionCheckoutAttempt,
  status: SubscriptionStatusSnapshot
): boolean => {
  if (!status.is_active) {
    return false
  }

  if (attempt.operation === 'resubscribe') {
    return (
      attempt.previous_cancel_at !== undefined &&
      (status.cancel_at ?? null) !== attempt.previous_cancel_at &&
      getTierFromStatus(status) === attempt.tier &&
      getCycleFromStatus(status) === attempt.cycle
    )
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

  const wasReportedTerminal = getPendingCheckoutTerminal(attempt.attempt_id)
  clearPendingSubscriptionCheckoutAttempt()

  const value = getCheckoutValue(attempt.tier, attempt.cycle)

  return {
    checkout_attempt_id: attempt.attempt_id,
    tier: attempt.tier,
    cycle: attempt.cycle,
    checkout_type: attempt.checkout_type,
    ...(attempt.previous_tier ? { previous_tier: attempt.previous_tier } : {}),
    ...(attempt.payment_intent_source
      ? { payment_intent_source: attempt.payment_intent_source }
      : {}),
    ...(attempt.operation ? { operation: attempt.operation } : {}),
    ...(attempt.resubscribe_source
      ? { resubscribe_source: attempt.resubscribe_source }
      : {}),
    ...(wasReportedTerminal
      ? { recovery_outcome: 'late_success' as const }
      : {}),
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
