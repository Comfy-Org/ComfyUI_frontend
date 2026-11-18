import type {
  PlanNotStartedBanner,
  RecoveryPaymentPage
} from '@comfyorg/account-core/billing'
import { shallowRef, watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import { billingApi } from '@/platform/billing/api/billingApi'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { hostedBillingRoute } from '@/platform/billing/hostedBillingRoutes'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { reportError } from '@comfyorg/telemetry/reportError'

type RecoverySource = 'plans' | 'status'

let pendingPaymentRefresh: {
  readonly source: RecoverySource
  readonly stop: () => void
} | null = null

function armPendingPaymentRefresh(
  source: RecoverySource,
  refresh: () => Promise<unknown>
) {
  pendingPaymentRefresh?.stop()
  pendingPaymentRefresh = { source, stop: registerRefreshOnReturn(refresh) }
}

function disarmPendingPaymentRefresh(source: RecoverySource) {
  if (pendingPaymentRefresh?.source !== source) return
  pendingPaymentRefresh.stop()
  pendingPaymentRefresh = null
}

/** Opens the served payment action for an unpaid initial-signup invoice, read from the plans or the status copy of the served fact. */
export function useSubscriptionPaymentRecovery(
  source: RecoverySource = 'plans'
) {
  const billing = useBillingContext()
  const { fetchPlans, fetchStatus } = billing
  const subscriptionPaymentRecovery = {
    plans: billing.subscriptionPaymentRecovery,
    status: billing.statusPaymentRecovery
  }[source]
  const capabilities = useBillingCapabilities()
  const { flags } = useFeatureFlags()
  const workspace = useWorkspaceIdentity()

  function paymentPageOf(
    operation: Awaited<ReturnType<typeof billingApi.getBillingOpStatus>>
  ): RecoveryPaymentPage {
    if (operation.action_url) return { kind: 'hostedPage' }
    if (!operation.payment_intent_client_secret || !operation.plan) {
      return { kind: 'unavailable' }
    }
    const checkout = hostedBillingRoute(
      flags.hostedBillingDestination,
      'checkout',
      {
        plan: operation.plan.slug,
        teamCreditStopId: operation.plan.team_credit_stop_id,
        workspaceId: workspace.activeWorkspaceId ?? undefined
      }
    )
    return checkout.kind === 'billing_web'
      ? { kind: 'clientSecretOnly', checkoutUrl: checkout.url.href }
      : { kind: 'unavailable' }
  }

  function isServedRecovery(opId: string) {
    return subscriptionPaymentRecovery.value?.billing_op_id === opId
  }
  const toast = useToast()
  const isOpeningPayment = shallowRef(false)
  const recoveryPlanTier = shallowRef<PlanNotStartedBanner['planTier']>(null)
  const recoveryPaymentPage = shallowRef<RecoveryPaymentPage>({
    kind: 'loading'
  })

  watch(
    () => subscriptionPaymentRecovery.value?.billing_op_id,
    async (opId) => {
      recoveryPlanTier.value = null
      recoveryPaymentPage.value = { kind: 'loading' }
      if (!opId) {
        disarmPendingPaymentRefresh(source)
        return
      }
      try {
        const operation = await billingApi.getBillingOpStatus(opId)
        if (!isServedRecovery(opId)) return
        recoveryPlanTier.value = operation.plan?.tier ?? null
        recoveryPaymentPage.value = paymentPageOf(operation)
      } catch (error) {
        if (isServedRecovery(opId)) {
          recoveryPaymentPage.value = { kind: 'unavailable' }
        }
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
      if (!isServedRecovery(recovery.billing_op_id)) {
        tab.close()
        return
      }
      if (!operation.action_url) {
        tab.close()
        reportPaymentUnavailable()
        return
      }
      tab.navigate(operation.action_url)
      armPendingPaymentRefresh(source, refreshBillingState)
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

  function refreshOnVerificationReturn() {
    armPendingPaymentRefresh(source, refreshBillingState)
  }

  return {
    subscriptionPaymentRecovery,
    recoveryPlanTier,
    recoveryPaymentPage,
    isOpeningPayment,
    finishPayment,
    refreshOnVerificationReturn
  }
}
