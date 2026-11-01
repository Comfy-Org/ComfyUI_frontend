import { onMounted, ref } from 'vue'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { useCommandStore } from '@/platform/keybindings/commandStore'

/** Opens support through Comfy.ContactSupport, tracks the click, and reports a failure to open it. */
export function useMessageSupport() {
  const commandStore = useCommandStore()
  const telemetry = useTelemetry()
  const { wrapWithErrorHandlingAsync, toastErrorHandler } = useErrorHandling()

  const isLoadingSupport = ref(false)

  const reportSupportFailure = (error: unknown) => {
    reportError(error, {
      surface: 'billing',
      errorType: 'contact_support_failed'
    })
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

  return { isLoadingSupport, handleMessageSupport }
}

/**
 * Composable for handling subscription panel actions and loading states
 */
export function useSubscriptionActions() {
  const { showTopUpCreditsDialog } = useBillingDialogs()
  const telemetry = useTelemetry()
  const { fetchBalance, fetchStatus } = useBillingContext()
  const { isLoadingSupport, handleMessageSupport } = useMessageSupport()

  onMounted(() => {
    void handleRefresh()
  })

  const handleAddApiCredits = () => {
    telemetry?.trackAddApiCreditButtonClicked({
      source: 'settings_billing_panel'
    })
    void showTopUpCreditsDialog({
      source: paymentIntentSourceForAddCreditsClick('settings_billing_panel')
    })
  }

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
