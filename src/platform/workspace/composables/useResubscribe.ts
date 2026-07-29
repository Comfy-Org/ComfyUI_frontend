import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

/**
 * Reactivates a cancelled-but-still-active subscription and surfaces success or
 * failure as a toast, tracking the in-flight state for the calling button.
 */
export function useResubscribe() {
  const { t } = useI18n()
  const toast = useToast()
  const { resubscribe } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { permissions } = useWorkspaceUI()

  const isResubscribing = ref(false)

  async function handleResubscribe() {
    if (
      shouldUseWorkspaceBilling.value &&
      !permissions.value.canManageSubscriptionLifecycle
    ) {
      return
    }

    useTelemetry()?.trackResubscribeClicked({
      source: 'settings_billing_panel'
    })
    isResubscribing.value = true
    try {
      await resubscribe()
      if (shouldUseWorkspaceBilling.value) {
        useTelemetry()?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source: 'settings_billing_panel'
        })
      }
      toast.add({
        severity: 'success',
        summary: t('subscription.resubscribeSuccess'),
        life: 5000
      })
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message
          : t('subscription.resubscribeFailed')
      if (shouldUseWorkspaceBilling.value) {
        useTelemetry()?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'failed',
          outcome: 'failure',
          source: 'settings_billing_panel',
          failure_category: 'unknown'
        })
      }
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail
      })
    } finally {
      isResubscribing.value = false
    }
  }

  return { isResubscribing, handleResubscribe }
}
