import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { AccountPrecondition } from '@/platform/errorCatalog/accountPreconditionRouting'
import { useDialogService } from '@/services/dialogService'

interface AccountPreconditionContext {
  /** Node type that triggered the precondition, used as modal context. */
  nodeType?: string
}

// Routes a resolved account precondition to its dedicated modal. This is the
// single seam where FE-978 attaches role-aware (member vs owner) subscription
// content: the `subscription` branch resolves to the subscription dialog, whose
// inner content FE-978 specializes for cancelled/inactive team states.
export function useAccountPreconditionDialog() {
  const dialogService = useDialogService()

  function open(
    precondition: AccountPrecondition,
    context: AccountPreconditionContext = {}
  ): void {
    switch (precondition) {
      case 'sign_in':
        void dialogService.showApiNodesSignInDialog(
          context.nodeType ? [context.nodeType] : []
        )
        return
      case 'subscription':
        void dialogService.showSubscriptionRequiredDialog({
          reason: 'subscription_required'
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
        void dialogService.showTopUpCreditsDialog({
          isInsufficientCredits: true
        })
        return
      }
    }
  }

  return { open }
}
