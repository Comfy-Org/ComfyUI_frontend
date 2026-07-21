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
      toast.add({
        severity: 'success',
        summary: t('subscription.resubscribeSuccess'),
        life: 5000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: error instanceof Error ? error.message : t('g.error')
      })
    } finally {
      isResubscribing.value = false
    }
  }

  return { isResubscribing, handleResubscribe }
}
