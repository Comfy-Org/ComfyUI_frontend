import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { getTeamPlanSlug } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useTelemetry } from '@/platform/telemetry'
import type {
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

type CheckoutStep = 'pricing' | 'preview' | 'success'
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
  const {
    subscribe,
    previewSubscribe,
    plans,
    fetchStatus,
    fetchBalance,
    resubscribe
  } = useBillingContext()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()

  const checkoutStep = ref<CheckoutStep>('pricing')
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedTeamStop = ref<TeamPlanSelection | null>(null)
  const selectedBillingCycle = ref<BillingCycle>('yearly')
  const isPolling = computed(() => billingOperationStore.hasPendingOperations)
  const isTeamCheckout = computed(() => selectedTeamStop.value !== null)

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

  /**
   * Team-plan checkout entry: show the display-only "Confirm your payment" step
   * for the selected slider stop, then subscribe via `handleTeamSubscription`.
   */
  function handleSubscribeTeamClick(payload: {
    stop: TeamPlanSelection
    billingCycle: BillingCycle
  }) {
    selectedTeamStop.value = payload.stop
    selectedBillingCycle.value = payload.billingCycle
    selectedTierKey.value = null
    previewData.value = null
    checkoutStep.value = 'preview'
  }

  function handleBackToPricing() {
    checkoutStep.value = 'pricing'
    previewData.value = null
    selectedTeamStop.value = null
  }

  function handleSuccessClose() {
    emit('close', true)
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
      const response = await subscribe(planSlug, {
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
      })

      await handleSubscribeResponse(response)
    } catch (error) {
      showSubscribeError(error)
    } finally {
      isSubscribing.value = false
    }
  }

  function showSubscribeError(error: unknown) {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail:
        error instanceof Error
          ? error.message
          : t('subscription.subscribeFailed')
    })
  }

  async function handleSubscribeResponse(
    response: SubscribeResponse | void
  ): Promise<void> {
    if (!response) return

    if (response.status === 'subscribed') {
      telemetry?.trackMonthlySubscriptionSucceeded()
      await Promise.all([fetchStatus(), fetchBalance()])
      checkoutStep.value = 'success'
      return
    }

    // needs_payment_method / pending_payment both finish asynchronously, so poll
    // the billing op either way. needs_payment_method additionally points at a
    // Stripe page to collect a card when the backend supplies the URL; without
    // it we still poll rather than silently stranding the user on confirm.
    if (
      response.status === 'needs_payment_method' &&
      response.payment_method_url
    ) {
      // The open runs after `await subscribe(...)`, so it's not a direct user
      // gesture and can be popup-blocked; warn instead of failing silently.
      const paymentWindow = window.open(response.payment_method_url, '_blank')
      if (!paymentWindow) {
        toast.add({
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('subscription.preview.paymentPopupBlocked')
        })
      }
    }
    await advanceToSuccessOnOperation(response.billing_op_id)
  }

  // A Stripe-backed subscribe finishes asynchronously: await the billing op and
  // advance to the success step ourselves. The store refreshes status/balance
  // before resolving and surfaces any failure via toast.
  async function advanceToSuccessOnOperation(opId: string) {
    const operation = await billingOperationStore.startOperation(
      opId,
      'subscription'
    )
    if (operation.status === 'succeeded') checkoutStep.value = 'success'
  }

  async function handleTeamSubscription() {
    const stop = selectedTeamStop.value
    if (!stop?.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      return
    }

    isSubscribing.value = true
    try {
      const planSlug = getTeamPlanSlug(selectedBillingCycle.value)
      const response = await subscribe(planSlug, {
        teamCreditStopId: stop.id,
        billingCycle: selectedBillingCycle.value,
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
      })

      await handleSubscribeResponse(response)
    } catch (error) {
      showSubscribeError(error)
    } finally {
      isSubscribing.value = false
    }
  }

  async function handleResubscribe() {
    isResubscribing.value = true
    try {
      await resubscribe()
      toast.add({
        severity: 'success',
        summary: t('subscription.resubscribeSuccess'),
        life: 5000
      })
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
    selectedTeamStop,
    selectedBillingCycle,
    isPolling,
    isTeamCheckout,
    handleSubscribeClick,
    handleSubscribeTeamClick,
    handleBackToPricing,
    handleSuccessClose,
    handleAddCreditCard: handleSubscription,
    handleConfirmTransition: handleSubscription,
    handleTeamSubscribe: handleTeamSubscription,
    handleResubscribe
  }
}
