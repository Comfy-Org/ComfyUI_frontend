import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useTelemetry } from '@comfyorg/telemetry'
import { categorizeBillingApiError } from '@/platform/billing/utils/billingFailureCategory'
import { useBillingUI } from '@/platform/billing/composables/useBillingUI'
import type { PlanCommandOutcome } from '@comfyorg/account-core/billing'

/**
 * Reactivates a cancelled-but-still-active subscription and surfaces success or
 * failure as a toast, tracking the in-flight state for the calling button.
 * Resolves to the outcome so a confirm can stay open on refusal.
 */
export function useResubscribe() {
  const { t } = useI18n()
  const toast = useToast()
  const { resubscribe } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { canReactivatePlan } = useBillingUI()

  const isResubscribing = ref(false)

  async function handleResubscribe(): Promise<PlanCommandOutcome> {
    if (!canReactivatePlan.value) return { ok: false, serverMessage: null }

    const source = 'settings_billing_panel' as const
    const startedAt = Date.now()
    const isWorkspaceResubscribe = shouldUseWorkspaceBilling.value

    useTelemetry()?.trackResubscribeClicked({ source })
    useTelemetry()?.trackBillingEvent({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source
    })
    isResubscribing.value = true
    try {
      await resubscribe({ source })
      if (isWorkspaceResubscribe) {
        useTelemetry()?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source,
          duration_ms: Date.now() - startedAt
        })
      }
      toast.success(t('subscription.resubscribeSuccess'), { duration: 5000 })
      return { ok: true }
    } catch (error) {
      const serverMessage =
        error instanceof Error && error.message.trim() ? error.message : null
      useTelemetry()?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source,
        failure_category: categorizeBillingApiError(error),
        ...(isWorkspaceResubscribe && {
          duration_ms: Date.now() - startedAt
        })
      })
      toast.error(t('g.error'), {
        description: serverMessage ?? t('subscription.resubscribeFailed')
      })
      return { ok: false, serverMessage }
    } finally {
      isResubscribing.value = false
    }
  }

  return { isResubscribing, handleResubscribe }
}
