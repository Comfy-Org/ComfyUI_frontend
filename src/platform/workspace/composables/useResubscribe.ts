import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
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
  const { canReactivate } = useBillingCapabilities()
  const { permissions } = useWorkspaceUI()

  const isResubscribing = ref(false)

  async function handleResubscribe() {
    if (
      shouldUseWorkspaceBilling.value &&
      !(isCloud
        ? canReactivate.value
        : permissions.value.canManageSubscriptionLifecycle)
    ) {
      return
    }

    const source = 'settings_billing_panel' as const

    useTelemetry()?.trackResubscribeClicked({ source })
    // Emitted before the awaited call so a failure always has a preceding
    // `started` — emitting it only after the call meant a failure produced a
    // `failed` with no matching `started`, pushing failed/started over 100%.
    useTelemetry()?.trackBillingEvent({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source
    })
    isResubscribing.value = true
    try {
      await resubscribe({ source })
      // Workspace's resubscribe() call is itself the terminal reactivation, so it
      // gets an immediate `succeeded` here. Legacy only opens a Stripe checkout
      // tab, which isn't terminal — its `succeeded` is emitted later, from
      // useSubscription.ts's pending-checkout recovery, once a status poll
      // confirms the payment actually went through.
      if (shouldUseWorkspaceBilling.value) {
        useTelemetry()?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source
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
      useTelemetry()?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source,
        failure_category: categorizeBillingApiError(error)
      })
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
