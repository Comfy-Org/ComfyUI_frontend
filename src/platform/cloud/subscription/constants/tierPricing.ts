import type { components } from '@/types/comfyRegistryTypes'

type SubscriptionTier = components['schemas']['SubscriptionTier']

export type TierKey = 'standard' | 'creator' | 'pro' | 'founder'

export const TIER_TO_KEY: Record<SubscriptionTier, TierKey> = {
  STANDARD: 'standard',
  CREATOR: 'creator',
  PRO: 'pro',
  FOUNDERS_EDITION: 'founder'
}

export interface TierPricing {
  monthly: number
  yearly: number
  credits: number
  videoEstimate: number
}

export const TIER_PRICING: Record<Exclude<TierKey, 'founder'>, TierPricing> = {
  standard: { monthly: 20, yearly: 16, credits: 4200, videoEstimate: 164 },
  creator: { monthly: 35, yearly: 28, credits: 7400, videoEstimate: 288 },
  pro: { monthly: 100, yearly: 80, credits: 21100, videoEstimate: 821 }
}

interface TierFeatures {
  customLoRAs: boolean
}

export const TIER_FEATURES: Record<TierKey, TierFeatures> = {
  standard: { customLoRAs: false },
  creator: { customLoRAs: true },
  pro: { customLoRAs: true },
  founder: { customLoRAs: false }
}

export const DEFAULT_TIER_KEY: TierKey = 'standard'

export function getTierPrice(tierKey: TierKey): number {
  if (tierKey === 'founder') return 20
  return TIER_PRICING[tierKey].monthly
}

export function getTierCredits(tierKey: TierKey): number {
  if (tierKey === 'founder') return 5460
  return TIER_PRICING[tierKey].credits
}
