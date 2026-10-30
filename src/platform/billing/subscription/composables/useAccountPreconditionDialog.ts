import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import PersonalWalletCreditsDialog from '@/platform/billing/components/PersonalWalletCreditsDialog.vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { AccountPrecondition } from '@/platform/workflowErrors/errorCatalog/accountPreconditionRouting'
import type { PaymentIntentSource } from '@comfyorg/telemetry/types'
import { setOutOfCreditsTopUpResume } from '@/platform/billing/subscription/composables/useTopUpUrlLoader'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import type { PersonalWalletCredential } from '@/platform/workflowErrors/errorCatalog/runtimeErrorMatcher'
import { useWorkspaceCreditsSource } from '@/platform/workspace/ports/workspaceCreditsSource'
import { useDialogStore } from '@/stores/dialogStore'

const PERSONAL_WALLET_DIALOG_KEY = 'personal-wallet-credits'

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
  const dialogStore = useDialogStore()

  function closePersonalWalletDialog(): void {
    dialogStore.closeDialog({ key: PERSONAL_WALLET_DIALOG_KEY })
  }

  function showTopUpForExhaustedBalance(
    context: AccountPreconditionContext
  ): void {
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
  }

  function showPersonalWalletDialog(
    credential: PersonalWalletCredential,
    context: AccountPreconditionContext
  ): void {
    const creditsSource = useWorkspaceCreditsSource()
    closePersonalWalletDialog()
    dialogStore.showDialog({
      key: PERSONAL_WALLET_DIALOG_KEY,
      component: PersonalWalletCreditsDialog,
      props: {
        credential,
        teamWorkspaces: creditsSource.teamWorkspaces,
        teamApiKeysUrl: `${getComfyPlatformBaseUrl()}/profile/api-keys`,
        onSwitchWorkspace: async (workspaceId: string) => {
          if (await creditsSource.switchWorkspace(workspaceId))
            closePersonalWalletDialog()
        },
        onAddCredits: async () => {
          setOutOfCreditsTopUpResume(true)
          const personalSwitch = await creditsSource.switchToPersonalWorkspace()
          if (personalSwitch === 'reloading') return
          setOutOfCreditsTopUpResume(false)
          if (personalSwitch === 'failed') return
          closePersonalWalletDialog()
          showTopUpForExhaustedBalance(context)
        },
        onClose: closePersonalWalletDialog
      },
      dialogComponentProps: {
        headless: true
      }
    })
  }

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
          reason: context.source ?? 'subscription_required'
        })
      case 'credits':
        showTopUpForExhaustedBalance(context)
        return true
      case 'personal_wallet_session':
        showPersonalWalletDialog('session', context)
        return true
      case 'personal_wallet_api_key':
        showPersonalWalletDialog('api_key', context)
        return true
    }
  }

  return { open }
}
