import { computed, shallowRef } from 'vue'

import type { BillingPortalOutcome } from '@/platform/billing/composables/types'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { reportError } from '@/platform/telemetry/reportError'
import SubscriptionPausedDialog from '@/platform/billing/components/SubscriptionPausedDialog.vue'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

const DIALOG_KEY = 'subscription-paused'

const paymentPortalRequest = shallowRef<Promise<BillingPortalOutcome> | null>(
  null
)

/** Whether the server refused top-up because a subscription payment is past due. */
export function isTopUpDeniedPastDue(denial: string | undefined): boolean {
  return denial === 'payment_past_due'
}

/** Opens the Update payment dialog, offering the portal only with `can_manage_billing`. */
export function usePaymentRecoveryDialog() {
  const { manageSubscription } = useBillingContext()
  const {
    canManageBilling,
    paymentRecoveryAvailable,
    runWorkflowsDenial,
    refresh: refreshCapabilities
  } = useBillingCapabilities()
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { toastErrorHandler } = useErrorHandling()

  const isUpdatingPayment = computed(() => paymentPortalRequest.value !== null)
  const runDeniedPaymentPastDue = computed(
    () => runWorkflowsDenial.value === 'payment_past_due'
  )
  const paymentRecoveryLock = computed<'owner' | 'member' | null>(() =>
    paymentRecoveryAvailable.value
      ? 'owner'
      : runDeniedPaymentPastDue.value
        ? 'member'
        : null
  )

  function closePaymentRecoveryDialog() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function showUpdatingPayment(isUpdatingPayment: boolean) {
    dialogStore.updateDialog({
      key: DIALOG_KEY,
      contentProps: { isUpdatingPayment }
    })
  }

  async function requestPaymentPortal(): Promise<BillingPortalOutcome> {
    try {
      return await manageSubscription()
    } catch (error) {
      reportError(error, {
        surface: 'billing',
        errorType: 'payment_recovery_portal_failure'
      })
      toastErrorHandler(error)
      return { ok: false, reason: 'failed' }
    }
  }

  async function openPaymentPortal(): Promise<BillingPortalOutcome> {
    showUpdatingPayment(true)
    const outcome = await requestPaymentPortal()
    showUpdatingPayment(false)
    if (outcome.ok) closePaymentRecoveryDialog()
    return outcome
  }

  /** Opens the billing portal once at a time; the dialog closes only when the portal opened. */
  function updatePayment(): Promise<BillingPortalOutcome> {
    paymentPortalRequest.value ??= openPaymentPortal().finally(() => {
      paymentPortalRequest.value = null
    })
    return paymentPortalRequest.value
  }

  async function updatePaymentFromDialog(onPortalOpened?: () => void) {
    const outcome = await updatePayment()
    if (outcome.ok) onPortalOpened?.()
  }

  /** `onPortalOpened` runs each time the billing portal opens from this dialog. */
  function showPaymentRecoveryDialog(onPortalOpened?: () => void) {
    return dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: SubscriptionPausedDialog,
      props: {
        canManage: canManageBilling.value,
        status: 'payment_failed',
        isUpdatingPayment: isUpdatingPayment.value,
        onClose: closePaymentRecoveryDialog,
        onUpdatePayment: () => updatePaymentFromDialog(onPortalOpened)
      },
      dialogComponentProps: {
        headless: true
      }
    })
  }

  return {
    showPaymentRecoveryDialog,
    updatePayment,
    isUpdatingPayment,
    paymentRecoveryLock,
    refreshCapabilities
  }
}
