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
  PaymentIntentSource,
  SubscriptionCheckoutType
} from '@/platform/telemetry/types'
import type {
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { trackWorkspaceCheckoutStarted } from '@/platform/workspace/utils/workspaceCheckoutTelemetry'

type CheckoutStep = 'pricing' | 'preview' | 'success'
export type CheckoutTierKey = Exclude<TierKey, 'free' | 'founder'>

export type SubscriptionCheckoutSelection =
  | {
      planMode: 'personal'
      tierKey: CheckoutTierKey
      billingCycle: BillingCycle
    }
  | {
      planMode: 'team'
      stop: TeamPlanSelection
      billingCycle: BillingCycle
    }

interface SelectedTeamCheckout {
  stop: TeamPlanSelection
  checkoutType: SubscriptionCheckoutType
}

interface SubscriptionCheckoutOptions {
  tierPlanType?: 'personal' | 'team'
}

/**
 * Which screen the `preview` step shows. Only a change prorates: a team change
 * carries `previewData` (handleSubscribeTeamClick sets it solely for an immediate
 * team transition), a personal change is anything other than `new_subscription`;
 * the rest are display-only fresh-subscribe confirms.
 */
type PreviewVariant =
  | 'team-change'
  | 'team-new'
  | 'personal-change'
  | 'personal-new'
  | null

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

export function useSubscriptionCheckout(
  emit: {
    (e: 'close', subscribed: boolean): void
  },
  paymentIntentSource?: PaymentIntentSource,
  { tierPlanType = 'personal' }: SubscriptionCheckoutOptions = {}
) {
  const { t } = useI18n()
  const toast = useToast()
  const {
    subscribe,
    previewSubscribe,
    plans,
    fetchPlans,
    isTeamPlan,
    resubscribe
  } = useBillingContext()
  const { permissions } = useWorkspaceUI()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()

  const checkoutStep = ref<CheckoutStep>('pricing')
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedTeamCheckout = ref<SelectedTeamCheckout | null>(null)
  const selectedBillingCycle = ref<BillingCycle>('yearly')
  const isPolling = computed(() => billingOperationStore.hasPendingOperations)
  const selectedTeamStop = computed(
    () => selectedTeamCheckout.value?.stop ?? null
  )
  const isTeamCheckout = computed(() => selectedTeamCheckout.value !== null)

  function canSelectTierPlan(): boolean {
    return (
      tierPlanType === 'team' ||
      !isTeamPlan.value ||
      permissions.value.canDowngradeToPersonal
    )
  }

  async function showTeamToPersonalDowngrade(
    planSlug: string,
    tierKey: CheckoutTierKey
  ): Promise<boolean> {
    if (tierPlanType === 'team' || !isTeamPlan.value) return false

    const { useDialogService } = await import('@/services/dialogService')
    const result = await useDialogService().showDowngradeToPersonalDialog({
      planName: t(`subscription.tiers.${tierKey}.name`),
      planSlug
    })
    if (!result) return true

    previewData.value = result.preview
    trackWorkspaceCheckoutStarted({
      tier: tierKey,
      cycle: selectedBillingCycle.value,
      checkoutType: 'change',
      billingOpId: result.response.billing_op_id,
      paymentIntentSource
    })
    await handleSubscribeResponse(result.response, result.preview.is_immediate)
    return true
  }

  const previewVariant = computed<PreviewVariant>(() => {
    if (selectedTeamCheckout.value) {
      return previewData.value ? 'team-change' : 'team-new'
    }
    if (previewData.value) {
      return previewData.value.transition_type === 'new_subscription'
        ? 'personal-new'
        : 'personal-change'
    }
    return null
  })

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
    if (!permissions.value.canManageSubscription || !canSelectTierPlan()) return

    const { tierKey, billingCycle } = payload

    isLoadingPreview.value = true
    loadingTier.value = tierKey
    selectedTierKey.value = tierKey
    selectedBillingCycle.value = billingCycle

    try {
      let planSlug = getApiPlanSlug(tierKey, billingCycle)
      if (!planSlug) {
        await fetchPlans()
        planSlug = getApiPlanSlug(tierKey, billingCycle)
      }
      if (!planSlug) {
        toast.add({
          severity: 'error',
          summary: 'Unable to subscribe',
          detail: 'This plan is not available'
        })
        return
      }
      if (await showTeamToPersonalDowngrade(planSlug, tierKey)) return
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
   * Team-plan checkout entry. A fresh subscribe has nothing to prorate and shows
   * the display-only "Confirm your payment" step. An existing subscriber changing
   * their credit commitment gets a prorated transition preview when the backend
   * can describe it; until `preview-subscribe` accepts a team stop the attempt
   * falls back to the same display-only step.
   */
  async function handleSubscribeTeamClick(payload: {
    stop: TeamPlanSelection
    billingCycle: BillingCycle
    isChange?: boolean
  }) {
    if (!permissions.value.canManageSubscription) return

    selectedTeamCheckout.value = {
      stop: payload.stop,
      checkoutType: payload.isChange ? 'change' : 'new'
    }
    selectedBillingCycle.value = payload.billingCycle
    selectedTierKey.value = null
    previewData.value = null
    checkoutStep.value = 'preview'

    if (!payload.isChange || !payload.stop.id) return
    try {
      const planSlug = getTeamPlanSlug(payload.billingCycle)
      const response = await previewSubscribe(planSlug, {
        teamCreditStopId: payload.stop.id,
        billingCycle: payload.billingCycle
      })
      if (
        response?.allowed &&
        response.is_immediate &&
        response.transition_type !== 'new_subscription'
      ) {
        previewData.value = response
      }
    } catch {
      // Preview is best-effort; keep the display-only confirm on any failure.
    }
  }

  function handleBackToPricing() {
    checkoutStep.value = 'pricing'
    previewData.value = null
    selectedTeamCheckout.value = null
  }

  function handleSuccessClose() {
    emit('close', true)
  }

  async function handleSubscription(
    paymentMethodType: 'card' | 'alipay' = 'card'
  ) {
    if (!permissions.value.canManageSubscription || !canSelectTierPlan()) return

    const tierKey = selectedTierKey.value
    if (!tierKey) return

    const billingCycle = selectedBillingCycle.value
    const checkoutType =
      previewData.value &&
      previewData.value.transition_type !== 'new_subscription'
        ? 'change'
        : 'new'

    isSubscribing.value = true
    try {
      const planSlug = getApiPlanSlug(tierKey, billingCycle)
      if (!planSlug) return
      if (await showTeamToPersonalDowngrade(planSlug, tierKey)) return
      const response = await subscribe(planSlug, {
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        paymentMethodType
      })

      if (response) {
        trackWorkspaceCheckoutStarted({
          tier: tierKey,
          cycle: billingCycle,
          checkoutType,
          billingOpId: response.billing_op_id,
          paymentIntentSource
        })
      }
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
    response: SubscribeResponse | void,
    shouldTrackSubscriptionSuccess = true
  ): Promise<void> {
    if (!response) return

    if (response.status === 'subscribed') {
      if (shouldTrackSubscriptionSuccess) {
        telemetry?.trackMonthlySubscriptionSucceeded()
      }
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

  async function handleTeamSubscription(
    paymentMethodType: 'card' | 'alipay' = 'card'
  ) {
    if (!permissions.value.canManageSubscription) return

    const teamCheckout = selectedTeamCheckout.value
    if (!teamCheckout?.stop.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      return
    }

    const { stop, checkoutType } = teamCheckout
    const billingCycle = selectedBillingCycle.value

    isSubscribing.value = true
    try {
      const planSlug = getTeamPlanSlug(billingCycle)
      const response = await subscribe(planSlug, {
        teamCreditStopId: stop.id,
        billingCycle,
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        paymentMethodType
      })

      if (response) {
        trackWorkspaceCheckoutStarted({
          tier: 'team',
          cycle: billingCycle,
          checkoutType,
          billingOpId: response.billing_op_id,
          paymentIntentSource
        })
      }
      await handleSubscribeResponse(response)
    } catch (error) {
      showSubscribeError(error)
    } finally {
      isSubscribing.value = false
    }
  }

  async function handleResubscribe() {
    if (!permissions.value.canManageSubscriptionLifecycle) return

    telemetry?.trackResubscribeClicked({
      source: 'pricing_dialog',
      payment_intent_source: paymentIntentSource
    })
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
    previewVariant,
    handleSubscribeClick,
    handleSubscribeTeamClick,
    handleBackToPricing,
    handleSuccessClose,
    handleAddCreditCard: handleSubscription,
    handleAuthorizeAlipay: () => handleSubscription('alipay'),
    handleConfirmTransition: handleSubscription,
    handleTeamSubscribe: handleTeamSubscription,
    handleTeamAlipaySubscribe: () => handleTeamSubscription('alipay'),
    handleResubscribe
  }
}
