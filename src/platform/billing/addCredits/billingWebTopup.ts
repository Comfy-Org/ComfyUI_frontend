import type { AutoTopUpActivation } from '@comfyorg/account-core/billing'
import type { EntryAutoTopUp } from '@comfyorg/billing-contract'

import { hostedBillingRoute } from '@/platform/billing/hostedBillingRoutes'

function entryAutoTopUpOf(activation: AutoTopUpActivation): EntryAutoTopUp {
  return {
    thresholdCredits: activation.threshold_credits,
    targetCredits: activation.target_credits,
    ...(activation.monthly_budget_cents === null
      ? {}
      : { monthlyBudgetCents: activation.monthly_budget_cents })
  }
}

/** billing-web's top-up page for this purchase, or undefined when this host has no billing-web entry to build. */
export function billingWebTopupUrl(
  amountCents: number,
  autoTopUp: AutoTopUpActivation | undefined,
  workspaceId: string | undefined,
  purchaseId: string
): string | undefined {
  const route = hostedBillingRoute('billing_web', 'top-up', {
    amountCents,
    purchaseId,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(autoTopUp === undefined
      ? {}
      : { autoTopUp: entryAutoTopUpOf(autoTopUp) })
  })
  return route.kind === 'billing_web' ? route.url.href : undefined
}
