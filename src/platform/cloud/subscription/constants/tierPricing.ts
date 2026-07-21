import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { components } from '@/types/comfyRegistryTypes'

export type SubscriptionTier = components['schemas']['SubscriptionTier']

export type TierKey = 'free' | 'standard' | 'creator' | 'pro' | 'founder'

export const TIER_TO_KEY: Record<SubscriptionTier, TierKey> = {
  FREE: 'free',
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'founder'
}

export const KEY_TO_TIER: Record<TierKey, SubscriptionTier> = {
  free: 'FREE',
  standard: 'STANDARD',
  creator: 'CREATOR',
  pro: 'PRO',
  founder: 'FOUNDERS_EDITION'
}

export interface TierPricing {
  monthly: number
  yearly: number
  credits: number
  videoEstimate: number
}

export const TIER_PRICING: Record<
  Exclude<TierKey, 'free' | 'founder'>,
  TierPricing
> = {
  standard: { monthly: 20, yearly: 16, credits: 4200, videoEstimate: 380 },
  creator: { monthly: 35, yearly: 28, credits: 7400, videoEstimate: 670 },
  pro: { monthly: 100, yearly: 80, credits: 21100, videoEstimate: 1915 }
}

interface TierFeatures {
  customLoRAs: boolean
  maxMembers: number
}

const TIER_FEATURES: Record<TierKey, TierFeatures> = {
  free: { customLoRAs: false, maxMembers: 1 },
  standard: { customLoRAs: false, maxMembers: 1 },
  creator: { customLoRAs: true, maxMembers: 5 },
  pro: { customLoRAs: true, maxMembers: 20 },
  founder: { customLoRAs: false, maxMembers: 1 }
}

export const DEFAULT_TIER_KEY: TierKey = 'standard'

export type PaidTierKey = Exclude<TierKey, 'free' | 'founder'>
export type BillingCycleKey = 'monthly' | 'yearly'

/**
 * PLACEHOLDER percents pending final coupon numbers; the ladder shape (deeper
 * cuts for higher tiers and yearly) is the contract. Must mirror the backend
 * Stripe coupons exactly — the display promises what the coupon charges.
 */
export const EDU_DISCOUNT_PERCENTS: Record<
  PaidTierKey,
  Record<BillingCycleKey, number>
> = {
  standard: { monthly: 10, yearly: 15 },
  creator: { monthly: 15, yearly: 20 },
  pro: { monthly: 20, yearly: 25 }
}

export const EDU_MAX_DISCOUNT_PERCENT = Math.max(
  ...Object.values(EDU_DISCOUNT_PERCENTS).flatMap((c) => [c.monthly, c.yearly])
)

/** Display-only EDU price; the backend coupon applies the same cut at checkout. */
export function applyEduDiscount(
  price: number,
  tierKey: PaidTierKey,
  cycle: BillingCycleKey
): number {
  const percent = EDU_DISCOUNT_PERCENTS[tierKey][cycle]
  return Math.round(price * (1 - percent / 100) * 100) / 100
}

const FOUNDER_MONTHLY_PRICE = 20
const FOUNDER_MONTHLY_CREDITS = 5460

export function getTierPrice(tierKey: TierKey, isYearly = false): number {
  if (tierKey === 'free') return 0
  if (tierKey === 'founder') return FOUNDER_MONTHLY_PRICE
  const pricing = TIER_PRICING[tierKey]
  return isYearly ? pricing.yearly : pricing.monthly
}

export function getTierCredits(tierKey: TierKey): number | null {
  if (tierKey === 'free') return remoteConfig.value.free_tier_credits ?? null
  if (tierKey === 'founder') return FOUNDER_MONTHLY_CREDITS
  return TIER_PRICING[tierKey].credits
}

export function getTierFeatures(tierKey: TierKey): TierFeatures {
  return TIER_FEATURES[tierKey]
}
