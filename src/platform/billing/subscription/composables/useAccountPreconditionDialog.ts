import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { AccountPrecondition } from '@/platform/workflowErrors/errorCatalog/accountPreconditionRouting'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

interface AccountPreconditionContext {
  /** Node type that triggered the precondition, used as modal context. */
  nodeType?: string
  source?: PaymentIntentSource
  creditsLocked?: boolean
  refusalType?: string
  runRefused?: boolean
}

export function useAccountPreconditionDialog() {
  const { showApiNodesSignInDialog } = useAuthDialogs()
  const { showSubscriptionRequiredDialog, showTopUpCreditsDialog } =
    useBillingDialogs()

  async function open(
    precondition: AccountPrecondition,
    context: AccountPreconditionContext = {}
  ): Promise<boolean> {
    switch (precondition) {
      case 'sign_in':
        void showApiNodesSignInDialog(
          context.nodeType ? [context.nodeType] : []
        )
        return true
      case 'subscription':
        return showSubscriptionRequiredDialog({
          reason: context.source ?? 'subscription_required',
          ...(context.creditsLocked !== undefined && {
            creditsLocked: context.creditsLocked
          }),
          ...(context.refusalType && { refusalType: context.refusalType }),
          ...(context.runRefused && { runRefused: true })
        })
      case 'credits': {
        const { fetchStatus, fetchBalance } = useBillingContext()
        void Promise.allSettled([fetchStatus(), fetchBalance()])
        void showTopUpCreditsDialog({
          isInsufficientCredits: true,
          ...(context.source && { source: context.source })
        })
        return true
      }
    }
  }

  return { open }
}
