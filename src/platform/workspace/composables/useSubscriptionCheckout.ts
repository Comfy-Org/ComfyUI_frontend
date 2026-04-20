import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useTelemetry } from '@/platform/telemetry'
import type {
  Plan,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

type CheckoutStep = 'pricing' | 'preview'
type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

export function findPlanSlug(
  plans: Plan[],
  tierKey: CheckoutTierKey,
  billingCycle: BillingCycle
): string | null {
  const apiDuration = billingCycle === 'yearly' ? 'ANNUAL' : 'MONTHLY'
  const apiTier = tierKey.toUpperCase()
  const plan = plans.find(
    (p) => p.tier === apiTier && p.duration === apiDuration
  )
  return plan?.slug ?? null
}

export function useSubscriptionCheckout(emit: {
  (e: 'close', subscribed: boolean): void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { subscribe, previewSubscribe, plans, fetchStatus, fetchBalance } =
    useBillingContext()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()

  const checkoutStep = ref<CheckoutStep>('pricing')
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedBillingCycle = ref<BillingCycle>('yearly')
  const isPolling = computed(() => billingOperationStore.hasPendingOperations)

  function getApiPlanSlug(
    tierKey: CheckoutTierKey,
    billingCycle: BillingCycle
  ): string | null {
    return findPlanSlug(plans.value, tierKey, billingCycle)
  }

  async function handleSubscribeClick(payload: {
    tierKey: CheckoutTierKey
    billingCycle: BillingCycle
  }) {
    const { tierKey, billingCycle } = payload

    isLoadingPreview.value = true
    loadingTier.value = tierKey
    selectedTierKey.value = tierKey
    selectedBillingCycle.value = billingCycle

    try {
      const planSlug = getApiPlanSlug(tierKey, billingCycle)
      if (!planSlug) {
        toast.add({
          severity: 'error',
          summary: 'Unable to subscribe',
          detail: 'This plan is not available'
        })
        return
      }
      const response = await previewSubscribe(planSlug)

      if (!response || !response.allowed) {
        toast.add({
          severity: 'error',
          summary: 'Unable to subscribe',
          detail: response?.reason || 'This plan is not available'
        })
        return
      }

      previewData.value = response
      checkoutStep.value = 'preview'
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load subscription preview'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: message
      })
    } finally {
      isLoadingPreview.value = false
      loadingTier.value = null
    }
  }

  function handleBackToPricing() {
    checkoutStep.value = 'pricing'
    previewData.value = null
  }

  async function handleSubscription() {
    if (!selectedTierKey.value) return

    isSubscribing.value = true
    try {
      const planSlug = getApiPlanSlug(
        selectedTierKey.value,
        selectedBillingCycle.value
      )
      if (!planSlug) return
      const response = await subscribe(
        planSlug,
        `${getComfyPlatformBaseUrl()}/payment/success`,
        `${getComfyPlatformBaseUrl()}/payment/failed`
      )

      if (!response) return

      if (response.status === 'subscribed') {
        telemetry?.trackMonthlySubscriptionSucceeded()
        toast.add({
          severity: 'success',
          summary: t('subscription.required.pollingSuccess'),
          life: 5000
        })
        await Promise.all([fetchStatus(), fetchBalance()])
        emit('close', true)
      } else if (
        response.status === 'needs_payment_method' &&
        response.payment_method_url
      ) {
        window.open(response.payment_method_url, '_blank')
        billingOperationStore.startOperation(
          response.billing_op_id,
          'subscription'
        )
      } else if (response.status === 'pending_payment') {
        billingOperationStore.startOperation(
          response.billing_op_id,
          'subscription'
        )
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to subscribe'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: message
      })
    } finally {
      isSubscribing.value = false
    }
  }

  async function handleResubscribe() {
    isResubscribing.value = true
    try {
      await workspaceApi.resubscribe()
      toast.add({
        severity: 'success',
        summary: t('subscription.resubscribeSuccess'),
        life: 5000
      })
      await Promise.all([fetchStatus(), fetchBalance()])
      emit('close', true)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to resubscribe'
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: message
      })
    } finally {
      isResubscribing.value = false
    }
  }

  return {
    checkoutStep,
    isLoadingPreview,
    loadingTier,
    isSubscribing,
    isResubscribing,
    previewData,
    selectedTierKey,
    selectedBillingCycle,
    isPolling,
    handleSubscribeClick,
    handleBackToPricing,
    handleAddCreditCard: handleSubscription,
    handleConfirmTransition: handleSubscription,
    handleResubscribe
  }
}
