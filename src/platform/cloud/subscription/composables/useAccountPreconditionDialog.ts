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
      case 'credits':
        void dialogService.showTopUpCreditsDialog({
          isInsufficientCredits: true
        })
        return
    }
  }

  return { open }
}
