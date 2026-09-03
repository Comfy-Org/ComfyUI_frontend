import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

export interface BillingRailPolicy {
  usesLegacyAccountOperations: boolean
  supportsChurnkeyCancellation: boolean
}

const FAIL_OPEN_POLICY: BillingRailPolicy = {
  usesLegacyAccountOperations: false,
  supportsChurnkeyCancellation: false
}

/**
 * Single decision site for `billing_rail`. Every consumer must classify the
 * rail through this policy so one value cannot be read two different ways. An
 * absent rail deliberately fails open: workspace-served, no Churnkey.
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
      return FAIL_OPEN_POLICY
    default:
      rail satisfies never
      return FAIL_OPEN_POLICY
  }
}
