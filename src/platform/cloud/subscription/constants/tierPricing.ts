import type { SubscriptionTier as IngestSubscriptionTier } from '@comfyorg/ingest-types'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { components } from '@/types/comfyRegistryTypes'

export type { IngestSubscriptionTier }

export type RegistrySubscriptionTier = components['schemas']['SubscriptionTier']

export type TierKey = 'free' | 'standard' | 'creator' | 'pro' | 'founder'

const TIER_TO_KEY: Record<RegistrySubscriptionTier, TierKey> = {
  FREE: 'free',
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'founder'
}

export const KEY_TO_TIER: Record<TierKey, RegistrySubscriptionTier> = {
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

// TEAM is workspace-level, so it maps to no key in this personal plan catalog.
export function toTierKey(tier: IngestSubscriptionTier): TierKey | null {
  return tier === 'TEAM' ? null : TIER_TO_KEY[tier]
}

// Includes the workspace-level TEAM, which toTierKey maps to null: a catalog
// key is not a usable test for "is on a paid plan".
export function hasActivePaidPlan(
  tier: IngestSubscriptionTier | null | undefined
): boolean {
  return tier != null && tier !== 'FREE'
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
