import type { BillingRail } from '@comfyorg/billing-core'

type BillingRailValue = BillingRail | null | undefined

/** Compile-time exhaustiveness check; unknown runtime values fall back to false. */
function assertNever(_rail: never): false {
  return false
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
