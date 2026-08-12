import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

export interface BillingRailPolicy {
  usesLegacyAccountOperations: boolean
  supportsChurnkeyCancellation: boolean
}

/**
 * Single decision site for `billing_rail` (ADR-0016). Every consumer must
 * classify the rail through this policy so one value cannot be read two
 * different ways. An absent rail deliberately fails open: workspace-served,
 * no Churnkey.
 */
export function getBillingRailPolicy(
  rail: BillingRail | null | undefined
): BillingRailPolicy {
  switch (rail) {
    case 'legacy_stripe':
      return {
        usesLegacyAccountOperations: true,
        supportsChurnkeyCancellation: false
      }
    case 'stripe':
      return {
        usesLegacyAccountOperations: false,
        supportsChurnkeyCancellation: true
      }
    case 'metronome':
      return {
        usesLegacyAccountOperations: false,
        supportsChurnkeyCancellation: false
      }
    case null:
    case undefined:
      return {
        usesLegacyAccountOperations: false,
        supportsChurnkeyCancellation: false
      }
    default:
      return rail satisfies never
  }
}
