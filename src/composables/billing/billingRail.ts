import type { BillingRail } from '@/platform/workspace/api/workspaceApi'

type BillingRailValue = BillingRail | null | undefined

/** Compile-time exhaustiveness check; unknown runtime values fall back to false. */
function assertNever(_rail: never): false {
  return false
}

/** Whether a personal workspace on this rail uses legacy account operations. */
export function usesLegacyAccountOperations(rail: BillingRailValue): boolean {
  switch (rail) {
    case 'legacy_stripe':
      return true
    case 'stripe':
    case 'metronome':
    case null:
    case undefined:
      return false
    default:
      return assertNever(rail)
  }
}

/** Whether the in-app cancellation flow supports this rail. */
export function supportsInAppCancellation(rail: BillingRailValue): boolean {
  switch (rail) {
    case 'stripe':
      return true
    // The metronome cancellation route is pending a backend decision.
    case 'metronome':
    case 'legacy_stripe':
    case null:
    case undefined:
      return false
    default:
      return assertNever(rail)
  }
}
