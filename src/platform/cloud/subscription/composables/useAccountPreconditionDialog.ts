import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { AccountPrecondition } from '@/platform/errorCatalog/accountPreconditionRouting'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'

interface AccountPreconditionContext {
  /** Node type that triggered the precondition, used as modal context. */
  nodeType?: string
  source?: PaymentIntentSource
}

// Routes a resolved account precondition to its dedicated modal. This is the
// single seam where FE-978 attaches role-aware (member vs owner) subscription
// content: the `subscription` branch resolves to the subscription dialog, whose
// inner content FE-978 specializes for cancelled/inactive team states.
export function useAccountPreconditionDialog() {
  const { showApiNodesSignInDialog } = useAuthDialogs()
  const { showSubscriptionRequiredDialog, showTopUpCreditsDialog } =
    useBillingDialogs()

  function open(
    precondition: AccountPrecondition,
    context: AccountPreconditionContext = {}
  ): void {
    switch (precondition) {
      case 'sign_in':
        void showApiNodesSignInDialog(
          context.nodeType ? [context.nodeType] : []
        )
        return
      case 'subscription':
        void showSubscriptionRequiredDialog({
          reason: context.source ?? 'subscription_required'
        })
        return
      case 'credits': {
        // The server just declared the balance exhausted; there is no push or
        // polling for billing state, so refresh it here to converge
        // hasFunds-keyed surfaces such as the credits-exhausted banner. The
        // refresh is best-effort: allSettled keeps a flaky billing API from
        // surfacing as unhandled rejections.
        const { fetchStatus, fetchBalance } = useBillingContext()
        void Promise.allSettled([fetchStatus(), fetchBalance()])
        void showTopUpCreditsDialog({
          isInsufficientCredits: true,
          ...(context.source && { source: context.source })
        })
        return
      }
    }
  }

  return { open }
}
