import { onMounted, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'

/**
 * Composable for handling subscription panel actions and loading states
 */
export function useSubscriptionActions() {
  const dialogService = useDialogService()
  const commandStore = useCommandStore()
  const telemetry = useTelemetry()
  const { fetchBalance, fetchStatus } = useBillingContext()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const isLoadingSupport = ref(false)

  onMounted(() => {
    void handleRefresh()
  })

  const handleAddApiCredits = () => {
    telemetry?.trackAddApiCreditButtonClicked({
      source: 'settings_billing_panel'
    })
    void dialogService.showTopUpCreditsDialog()
  }

  // A user who cannot reach support cannot tell us that they cannot reach
  // support, so this failure has to report itself.
  const reportSupportFailure = (error: unknown) => {
    reportError(error, { errorType: 'contact_support_failed' })
    toastErrorHandler(error)
  }

  const handleMessageSupport = wrapWithErrorHandlingAsync(
    async () => {
      isLoadingSupport.value = true
      telemetry?.trackHelpResourceClicked({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'subscription'
      })
      await commandStore.execute('Comfy.ContactSupport')
    },
    reportSupportFailure,
    () => {
      isLoadingSupport.value = false
    }
  )

  const handleRefresh = async () => {
    try {
      await Promise.all([fetchBalance(), fetchStatus()])
    } catch (error) {
      console.error('[useSubscriptionActions] Error refreshing data:', error)
    }
  }

  const handleLearnMoreClick = () => {
    window.open('https://docs.comfy.org/get_started/cloud', '_blank')
  }

  return {
    isLoadingSupport,
    handleAddApiCredits,
    handleMessageSupport,
    handleRefresh,
    handleLearnMoreClick
  }
}
