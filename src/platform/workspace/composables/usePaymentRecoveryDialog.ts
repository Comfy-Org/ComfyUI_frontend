import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { reportError } from '@/platform/telemetry/reportError'
import SubscriptionPausedDialog from '@/platform/workspace/components/SubscriptionPausedDialog.vue'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-paused'

let paymentPortalRequest: Promise<void> | null = null

/** Whether the server refused top-up because a subscription payment is past due. */
export function isTopUpDeniedPastDue(denial: string | undefined): boolean {
  return denial === 'payment_past_due'
}

/** Opens the Update payment dialog, offering the portal only with `can_manage_billing`. */
export function usePaymentRecoveryDialog() {
  const { manageSubscription } = useBillingContext()
  const { canManageBilling } = useBillingCapabilities()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { toastErrorHandler } = useErrorHandling()

  function closePaymentRecoveryDialog() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function showUpdatingPayment(isUpdatingPayment: boolean) {
    dialogStore.updateDialog({
      key: DIALOG_KEY,
      contentProps: { isUpdatingPayment }
    })
  }

  async function openPaymentPortal() {
    showUpdatingPayment(true)
    try {
      await manageSubscription()
      closePaymentRecoveryDialog()
    } catch (error) {
      reportError(error, {
        surface: 'billing',
        errorType: 'payment_recovery_portal_failure'
      })
      toastErrorHandler(error)
    } finally {
      showUpdatingPayment(false)
      paymentPortalRequest = null
    }
  }

  function updatePayment(): Promise<void> {
    paymentPortalRequest ??= openPaymentPortal()
    return paymentPortalRequest
  }

  function showPaymentRecoveryDialog() {
    return dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: SubscriptionPausedDialog,
      props: {
        canManage: canManageBilling.value,
        status: 'payment_failed',
        isUpdatingPayment: paymentPortalRequest !== null,
        onClose: closePaymentRecoveryDialog,
        onUpdatePayment: updatePayment
      },
      dialogComponentProps: {
        headless: true
      }
    })
  }

  return { showPaymentRecoveryDialog }
}
