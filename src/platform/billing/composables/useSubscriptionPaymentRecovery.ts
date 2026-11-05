import type { SubscriptionTier } from '@comfyorg/ingest-types'
import { shallowRef, watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { billingApi } from '@/platform/billing/api/billingApi'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { reportError } from '@comfyorg/telemetry/reportError'

let stopReturnRefresh: (() => void) | null = null

/** Opens the served payment action for an unpaid initial-signup invoice that holds plan changes. */
export function useSubscriptionPaymentRecovery() {
  const { subscriptionPaymentRecovery, fetchPlans, fetchStatus } =
    useBillingContext()
  const capabilities = useBillingCapabilities()
  const toast = useToast()
  const isOpeningPayment = shallowRef(false)
  const recoveryPlanTier = shallowRef<SubscriptionTier | null>(null)

  watch(
    () => subscriptionPaymentRecovery.value?.billing_op_id,
    async (opId) => {
      recoveryPlanTier.value = null
      if (!opId) {
        stopReturnRefresh?.()
        stopReturnRefresh = null
        return
      }
      try {
        const operation = await billingApi.getBillingOpStatus(opId)
        if (subscriptionPaymentRecovery.value?.billing_op_id !== opId) return
        recoveryPlanTier.value = operation.plan?.tier ?? null
      } catch (error) {
        reportError(error, {
          surface: 'billing',
          errorType: 'error_reading_signup_payment_recovery_plan'
        })
      }
    },
    { immediate: true }
  )

  function refreshBillingState() {
    return Promise.allSettled([
      fetchPlans(),
      fetchStatus(),
      capabilities.refresh()
    ])
  }

  function refreshOnReturn() {
    stopReturnRefresh?.()
    stopReturnRefresh = registerRefreshOnReturn(refreshBillingState)
  }

  function reportPaymentUnavailable() {
    toast.error(t('subscription.signupPaymentRecovery.unavailable'))
    void refreshBillingState()
  }

  async function finishPayment(): Promise<void> {
    const recovery = subscriptionPaymentRecovery.value
    if (!recovery || isOpeningPayment.value) return
    const tab = reserveBillingTab()
    if (!tab) {
      toast.warning(t('g.warning'), {
        description: t('subscription.preview.paymentPopupBlocked')
      })
      return
    }
    isOpeningPayment.value = true
    try {
      const operation = await billingApi.getBillingOpStatus(
        recovery.billing_op_id
      )
      if (!operation.action_url) {
        tab.close()
        reportPaymentUnavailable()
        return
      }
      tab.navigate(operation.action_url)
      refreshOnReturn()
    } catch (error) {
      tab.close()
      reportError(error, {
        surface: 'billing',
        errorType: 'error_reading_signup_payment_recovery_action'
      })
      reportPaymentUnavailable()
    } finally {
      isOpeningPayment.value = false
    }
  }

  return {
    subscriptionPaymentRecovery,
    recoveryPlanTier,
    isOpeningPayment,
    finishPayment
  }
}
