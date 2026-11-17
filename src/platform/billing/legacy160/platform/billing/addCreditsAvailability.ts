import type { BillingTopUpDenial } from '@comfyorg/billing-core'

export type AddCreditsAvailability =
  | { kind: 'enabled' }
  | { kind: 'hidden' }
  | { kind: 'disabled'; reasonKey: string }

const MEMBER_TOP_UP_DENIALS: ReadonlySet<BillingTopUpDenial> = new Set([
  'not_workspace_owner',
  'not_a_member'
])

const REFUSAL_REASON_KEYS: Partial<Record<BillingTopUpDenial, string>> = {
  topup_purchases_paused: 'credits.addCreditsRefusal.topupPurchasesPaused',
  payment_past_due: 'credits.addCreditsRefusal.paymentPastDue'
}

const UNAVAILABLE_REASON_KEY = 'credits.addCreditsRefusal.unavailable'

/** Whether the served `can_top_up` refusal names someone who is not the workspace owner. */
export function isMemberTopUpDenial(
  denial: BillingTopUpDenial | undefined
): boolean {
  return denial !== undefined && MEMBER_TOP_UP_DENIALS.has(denial)
}

/** How Add credits renders for the served `can_top_up` and its denial reason. */
export function addCreditsAvailability(facts: {
  resolved: boolean
  canTopUp: boolean
  denial: BillingTopUpDenial | undefined
}): AddCreditsAvailability {
  if (facts.canTopUp) return { kind: 'enabled' }
  if (!facts.resolved || isMemberTopUpDenial(facts.denial)) {
    return { kind: 'hidden' }
  }
  const reasonKey =
    (facts.denial && REFUSAL_REASON_KEYS[facts.denial]) ??
    UNAVAILABLE_REASON_KEY
  return { kind: 'disabled', reasonKey }
}
