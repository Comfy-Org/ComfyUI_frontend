import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
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
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SavedPaymentMethod,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
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

/** Thrown by `assertReactivationAmountUnchanged` when a fresh preview's
 *  `cost_today_cents` no longer matches what the reactivation banner showed
 *  and the user consented to. Caught by the surrounding try/catch and
 *  surfaced through the same toast as any other subscribe failure. */
class ReactivationAmountChangedError extends Error {}

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
    fetchStatus,
    isTeamPlan,
    resubscribe,
    subscription
  } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { permissions } = useWorkspaceUI()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()
  const workspaceStore = useTeamWorkspaceStore()

  const checkoutStep = ref<CheckoutStep>('pricing')
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedTeamCheckout = ref<SelectedTeamCheckout | null>(null)
  const selectedBillingCycle = ref<BillingCycle>('yearly')
  const savedPaymentMethods = ref<SavedPaymentMethod[]>([])
  const selectedSavedPaymentMethodId = ref<string | null>(null)
  const isLoadingPaymentMethods = ref(false)
  const appliedPromotionCode = ref('')
  const promotionCodeError = ref<string | null>(null)
  const isApplyingPromotionCode = ref(false)
  const activeCheckoutOperationId = ref<string | null>(null)
  const activeCheckoutOperation = computed(() => {
    if (!activeCheckoutOperationId.value) {
      return billingOperationStore.subscriptionActionOperation
    }
    const operation = billingOperationStore.getOperation(
      activeCheckoutOperationId.value
    )
    return operation?.workspaceId === workspaceStore.activeWorkspaceId
      ? operation
      : undefined
  })
  const activeCheckoutActionUrl = computed(
    () => activeCheckoutOperation.value?.actionUrl ?? null
  )
  const isPolling = computed(
    () => activeCheckoutOperation.value?.status === 'pending'
  )
  const selectedTeamStop = computed(
    () => selectedTeamCheckout.value?.stop ?? null
  )
  const isTeamCheckout = computed(() => selectedTeamCheckout.value !== null)
  function isCancelled() {
    return subscription.value?.isCancelled ?? false
  }

  // A cancelled subscription needs confirm_reactivation, and the only place
  // that can honestly collect it is the reactivation banner. Paths with no
  // banner (add-payment preview, a preview-less team-new fallback) always
  // call in with confirmReactivation=false, so block here instead of sending
  // a request the BE is guaranteed to reject with no way for the user to
  // consent.
  function notifyReactivationConfirmationRequired(): void {
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subscription.preview.reactivation.confirmationRequired')
    })
  }

  // Shared by the initial cancelled-Team preview (handleSubscribeTeamClick)
  // and drift recovery (refreshPreviewOnReactivationBlock): a preview can
  // only feed the reactivation banner if it's allowed, immediate, and an
  // existing-plan change — new_subscription and scheduled changes route to
  // screens that can't render the disclosure or emit confirm_reactivation.
  function isReactivationCapablePreview(
    preview: PreviewSubscribeResponse | null | undefined
  ): boolean {
    return (
      !!preview?.allowed &&
      preview.is_immediate &&
      preview.transition_type !== 'new_subscription'
    )
  }

  // subscribe() recomputes the transaction independently of the preview the
  // banner showed, so proration or team-seat state can drift while the
  // screen is open. Re-preview right before billing and refuse if the
  // amount moved — mirrors the guard useDowngradeToPersonal applies before
  // a team-to-personal downgrade.
  async function assertReactivationAmountUnchanged(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<void> {
    const freshPreview = await previewSubscribe(planSlug, options)
    if (!freshPreview?.allowed) {
      throw new Error(freshPreview?.reason || t('subscription.subscribeFailed'))
    }
    const amountChanged =
      freshPreview.cost_today_cents !==
      (previewData.value?.cost_today_cents ?? 0)
    // Install regardless of outcome: on drift this is what makes the confirm
    // screen show the new amount and resets prior consent (via the
    // component's own chargeCents watcher), so the next attempt compares
    // against what's on screen instead of repeating this same failure.
    previewData.value = freshPreview
    if (amountChanged) {
      throw new ReactivationAmountChangedError(
        t('subscription.preview.reactivation.amountChanged')
      )
    }
  }

  // The reactivation guard below reads cached `subscription.isCancelled`. If
  // the subscription was cancelled in another tab after this preview loaded,
  // that cache is stale and the guard blocks a request the banner never
  // actually disclosed as a reactivation. Refresh here, right before the
  // guard, so a retry sees the real current transaction — but only install
  // the refresh if it can actually feed the banner; one that can't (e.g. it
  // comes back as a fresh subscribe) would leave every retry blocked on a
  // screen that can never collect consent, so send the user back to pricing
  // instead. Mirrors the fetchStatus() call useDowngradeToPersonal makes
  // before its own reactivation guard.
  async function refreshPreviewOnReactivationBlock(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<void> {
    let freshPreview: PreviewSubscribeResponse | null = null
    try {
      freshPreview = await previewSubscribe(planSlug, options)
    } catch {
      // Treated the same as an incapable preview below.
    }
    if (isReactivationCapablePreview(freshPreview)) {
      previewData.value = freshPreview
      notifyReactivationConfirmationRequired()
      return
    }
    handleBackToPricing()
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subscription.preview.reactivation.unavailable')
    })
  }

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
    await handleSubscribeResponse(
      result.response,
      {
        tier: tierKey,
        cycle: selectedBillingCycle.value,
        checkoutType: 'change'
      },
      result.preview.is_immediate
    )
    return true
  }

  const previewVariant = computed<PreviewVariant>(() => {
    if (selectedTeamCheckout.value) {
      return previewData.value?.transition_type === 'new_subscription'
        ? 'team-new'
        : 'team-change'
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

  function exactQuoteAvailable(preview: PreviewSubscribeResponse): boolean {
    return (
      typeof preview.quote_id === 'string' &&
      typeof preview.quote_version === 'number' &&
      typeof preview.amount_due_cents === 'number' &&
      typeof preview.currency === 'string' &&
      typeof preview.renewal_amount_cents === 'number' &&
      typeof preview.renewal_at === 'string'
    )
  }

  function previewCanBeReviewed(preview: PreviewSubscribeResponse): boolean {
    const hasQuoteContract =
      preview.quote_id !== undefined || preview.quote_version !== undefined
    return (
      preview.allowed && (!hasQuoteContract || exactQuoteAvailable(preview))
    )
  }

  function selectedPlanSlug(): string | null {
    if (selectedTeamCheckout.value) {
      return getTeamPlanSlug(selectedBillingCycle.value)
    }
    return selectedTierKey.value
      ? getApiPlanSlug(selectedTierKey.value, selectedBillingCycle.value)
      : null
  }

  function selectedPreviewOptions(
    promotionCode = appliedPromotionCode.value
  ): PreviewSubscribeOptions {
    return {
      ...(selectedTeamCheckout.value?.stop.id && {
        teamCreditStopId: selectedTeamCheckout.value.stop.id,
        billingCycle: selectedBillingCycle.value
      }),
      ...(promotionCode && { promotionCode })
    }
  }

  async function requote(promotionCode = appliedPromotionCode.value) {
    const planSlug = selectedPlanSlug()
    if (!planSlug) throw new Error(t('subscription.preview.quoteUnavailable'))
    const response = await previewSubscribe(
      planSlug,
      selectedPreviewOptions(promotionCode)
    )
    if (!response?.allowed || !exactQuoteAvailable(response)) {
      throw new Error(
        response?.reason || t('subscription.preview.quoteUnavailable')
      )
    }
    previewData.value = response
    return response
  }

  async function loadSavedPaymentMethods() {
    isLoadingPaymentMethods.value = true
    try {
      const methods = await workspaceApi.listSavedPaymentMethods()
      savedPaymentMethods.value = methods.filter(
        (method) => method.type === 'card' || method.type === 'alipay'
      )
      selectedSavedPaymentMethodId.value =
        savedPaymentMethods.value.find((method) => method.isDefault)?.id ??
        savedPaymentMethods.value[0]?.id ??
        null
    } catch {
      savedPaymentMethods.value = []
      selectedSavedPaymentMethodId.value = null
    } finally {
      isLoadingPaymentMethods.value = false
    }
  }

  async function applyPromotionCode(code: string): Promise<boolean> {
    isApplyingPromotionCode.value = true
    promotionCodeError.value = null
    try {
      const normalized = code.trim()
      const response = await requote(normalized)
      appliedPromotionCode.value = response.promotion_code ?? normalized
      return true
    } catch (error) {
      promotionCodeError.value =
        error instanceof Error
          ? error.message
          : t('subscription.preview.promotionCodeInvalid')
      return false
    } finally {
      isApplyingPromotionCode.value = false
    }
  }

  async function selectSavedPaymentMethod(id: string | null) {
    const previousId = selectedSavedPaymentMethodId.value
    selectedSavedPaymentMethodId.value = id
    promotionCodeError.value = null
    try {
      await requote()
    } catch (error) {
      selectedSavedPaymentMethodId.value = previousId
      showSubscribeError(error)
    }
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
    savedPaymentMethods.value = []
    selectedSavedPaymentMethodId.value = null

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

      if (!response || !previewCanBeReviewed(response)) {
        toast.add({
          severity: 'error',
          summary: 'Unable to subscribe',
          detail: response?.reason || 'This plan is not available'
        })
        return
      }

      previewData.value = response
      checkoutStep.value = 'preview'
      appliedPromotionCode.value = ''
      if (response.transition_type === 'new_subscription') {
        await loadSavedPaymentMethods()
      }
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
    savedPaymentMethods.value = []
    selectedSavedPaymentMethodId.value = null

    if (!payload.stop.id) return

    let response: PreviewSubscribeResponse | null = null
    let previewError: unknown
    try {
      const planSlug = getTeamPlanSlug(payload.billingCycle)
      response = await previewSubscribe(planSlug, {
        teamCreditStopId: payload.stop.id,
        billingCycle: payload.billingCycle
      })
    } catch (error) {
      previewError = error
    }

    if (
      response &&
      previewCanBeReviewed(response) &&
      (!isCancelled() || isReactivationCapablePreview(response))
    ) {
      previewData.value = response
      appliedPromotionCode.value = ''
      checkoutStep.value = 'preview'
      if (response.transition_type === 'new_subscription') {
        await loadSavedPaymentMethods()
      }
      return
    }
    toast.add({
      severity: 'error',
      summary: t('subscription.teamPlan.name'),
      detail:
        previewError instanceof Error
          ? previewError.message
          : response?.reason || t('subscription.subscribeFailed')
    })
    checkoutStep.value = 'pricing'
    selectedTeamCheckout.value = null
    savedPaymentMethods.value = []
    selectedSavedPaymentMethodId.value = null
    appliedPromotionCode.value = ''
    promotionCodeError.value = null
  }

  function handleBackToPricing() {
    if (isPolling.value) return
    checkoutStep.value = 'pricing'
    previewData.value = null
    selectedTeamCheckout.value = null
    activeCheckoutOperationId.value = null
    savedPaymentMethods.value = []
    selectedSavedPaymentMethodId.value = null
    appliedPromotionCode.value = ''
    promotionCodeError.value = null
  }

  function handleSuccessClose() {
    emit('close', true)
  }

  async function handleSubscription(
    confirmReactivation = false,
    confirmationToken?: string
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
      await fetchStatus()
      if (!confirmReactivation && isCancelled()) {
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      if (confirmReactivation && isCancelled()) {
        await assertReactivationAmountUnchanged(
          planSlug,
          selectedPreviewOptions()
        )
      }
      const response = await subscribe(planSlug, {
        ...(confirmationToken && { confirmationToken }),
        ...(selectedSavedPaymentMethodId.value && {
          savedPaymentMethodId: selectedSavedPaymentMethodId.value
        }),
        ...(previewData.value?.promotion_code && {
          promotionCode: previewData.value.promotion_code
        }),
        ...(previewData.value?.quote_id && {
          quoteId: previewData.value.quote_id
        }),
        ...(previewData.value?.quote_version !== undefined && {
          quoteVersion: previewData.value.quote_version
        }),
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        confirmReactivation
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
      await handleSubscribeResponse(response, {
        tier: tierKey,
        cycle: billingCycle,
        checkoutType
      })
    } catch (error) {
      if (await recoverQuoteOrPaymentMethod(error)) return
      trackSubscriptionFailure({
        tier: tierKey,
        cycle: billingCycle,
        checkoutType
      })
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

  async function recoverQuoteOrPaymentMethod(error: unknown): Promise<boolean> {
    if (!(error instanceof WorkspaceApiError)) return false
    if (error.code === 'INVALID_PAYMENT_METHOD') {
      savedPaymentMethods.value = []
      selectedSavedPaymentMethodId.value = null
      try {
        await requote()
      } catch {
        previewData.value = null
        checkoutStep.value = 'pricing'
      }
      showSubscribeError(
        new Error(t('subscription.preview.savedPaymentMethodUnavailable'))
      )
      return true
    }
    if (error.code === 'SUBSCRIPTION_QUOTE_STALE') {
      try {
        await requote()
      } catch {
        previewData.value = null
        checkoutStep.value = 'pricing'
      }
      showSubscribeError(new Error(t('subscription.preview.quoteStale')))
      return true
    }
    return false
  }

  interface SubscriptionOutcomeContext {
    tier: CheckoutTierKey | 'team'
    cycle: BillingCycle
    checkoutType: SubscriptionCheckoutType
  }

  function trackSubscriptionFailure(
    context: SubscriptionOutcomeContext,
    errorCode?: 'missing_checkout_response'
  ) {
    if (!shouldUseWorkspaceBilling.value) return

    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: context.tier,
      cycle: context.cycle,
      checkout_type: context.checkoutType,
      payment_intent_source: paymentIntentSource,
      failure_category: 'unknown',
      ...(errorCode && { error_code: errorCode })
    })
  }

  async function handleSubscribeResponse(
    response: SubscribeResponse | void,
    context: SubscriptionOutcomeContext,
    shouldTrackSubscriptionSuccess = true
  ): Promise<void> {
    if (!response) {
      trackSubscriptionFailure(context, 'missing_checkout_response')
      return
    }

    if (response.status === 'subscribed') {
      if (shouldTrackSubscriptionSuccess) {
        telemetry?.trackBillingEvent({
          operation: 'subscription_checkout',
          stage: 'succeeded',
          outcome: 'success',
          tier: context.tier,
          cycle: context.cycle,
          checkout_type: context.checkoutType,
          payment_intent_source: paymentIntentSource,
          billing_op_id: response.billing_op_id
        })
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
    await advanceToSuccessOnOperation(response.billing_op_id, context)
  }

  // A Stripe-backed subscribe finishes asynchronously: await the billing op and
  // advance to the success step ourselves. The store refreshes status/balance
  // before resolving and surfaces any failure via toast.
  async function advanceToSuccessOnOperation(
    opId: string,
    context: SubscriptionOutcomeContext
  ) {
    activeCheckoutOperationId.value = opId
    const operation = await billingOperationStore.startOperation(
      opId,
      'subscription',
      {
        tier: context.tier,
        cycle: context.cycle,
        checkoutType: context.checkoutType,
        paymentIntentSource,
        suppressProcessingToast: true
      }
    )
    if (
      operation.status === 'succeeded' &&
      activeCheckoutOperationId.value === opId &&
      operation.workspaceId === workspaceStore.activeWorkspaceId
    ) {
      checkoutStep.value = 'success'
    }
  }

  async function handleTeamSubscription(
    confirmReactivation = false,
    confirmationToken?: string
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
    const planSlug = getTeamPlanSlug(billingCycle)

    isSubscribing.value = true
    try {
      await fetchStatus()
      if (!confirmReactivation && isCancelled()) {
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
        return
      }
      if (confirmReactivation && isCancelled()) {
        await assertReactivationAmountUnchanged(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle,
          ...(appliedPromotionCode.value && {
            promotionCode: appliedPromotionCode.value
          })
        })
      }
      const response = await subscribe(planSlug, {
        ...(confirmationToken && { confirmationToken }),
        ...(selectedSavedPaymentMethodId.value && {
          savedPaymentMethodId: selectedSavedPaymentMethodId.value
        }),
        ...(previewData.value?.promotion_code && {
          promotionCode: previewData.value.promotion_code
        }),
        ...(previewData.value?.quote_id && {
          quoteId: previewData.value.quote_id
        }),
        ...(previewData.value?.quote_version !== undefined && {
          quoteVersion: previewData.value.quote_version
        }),
        teamCreditStopId: stop.id,
        billingCycle,
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        confirmReactivation
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
      await handleSubscribeResponse(response, {
        tier: 'team',
        cycle: billingCycle,
        checkoutType
      })
    } catch (error) {
      if (await recoverQuoteOrPaymentMethod(error)) return
      trackSubscriptionFailure({
        tier: 'team',
        cycle: billingCycle,
        checkoutType
      })
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
      if (shouldUseWorkspaceBilling.value) {
        telemetry?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source: 'pricing_dialog',
          payment_intent_source: paymentIntentSource
        })
      }
      toast.add({
        severity: 'success',
        summary: t('subscription.resubscribeSuccess'),
        life: 5000
      })
      emit('close', true)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to resubscribe'
      if (shouldUseWorkspaceBilling.value) {
        telemetry?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'failed',
          outcome: 'failure',
          source: 'pricing_dialog',
          payment_intent_source: paymentIntentSource,
          failure_category: 'unknown'
        })
      }
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: message
      })
    } finally {
      isResubscribing.value = false
    }
  }

  function handleSubscriptionPayment(confirmationToken: string) {
    return handleSubscription(false, confirmationToken)
  }

  function handleTeamSubscriptionPayment(confirmationToken: string) {
    return handleTeamSubscription(false, confirmationToken)
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
    savedPaymentMethods,
    selectedSavedPaymentMethodId,
    isLoadingPaymentMethods,
    appliedPromotionCode,
    promotionCodeError,
    isApplyingPromotionCode,
    activeCheckoutActionUrl,
    isPolling,
    isTeamCheckout,
    previewVariant,
    handleSubscribeClick,
    handleSubscribeTeamClick,
    handleBackToPricing,
    handleSuccessClose,
    handleAddCreditCard: handleSubscription,
    handleConfirmTransition: handleSubscription,
    handleTeamSubscribe: handleTeamSubscription,
    handleSubscriptionPayment,
    handleTeamSubscriptionPayment,
    applyPromotionCode,
    selectSavedPaymentMethod,
    handleResubscribe
  }
}
