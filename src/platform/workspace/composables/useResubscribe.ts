import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useTelemetry } from '@/platform/telemetry'

/**
 * Reactivates a cancelled-but-still-active subscription and surfaces success or
 * failure as a toast, tracking the in-flight state for the calling button.
 */
export function useResubscribe() {
  const { t } = useI18n()
  const toast = useToast()
  const { resubscribe } = useBillingContext()

  const isResubscribing = ref(false)

  async function handleResubscribe() {
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
