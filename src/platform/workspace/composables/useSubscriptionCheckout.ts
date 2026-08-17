import { useToast } from 'primevue/usetoast'
import { computed, onScopeDispose, ref, watch } from 'vue'
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
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { trackWorkspaceCheckoutStarted } from '@/platform/workspace/utils/workspaceCheckoutTelemetry'

type CheckoutStep = 'pricing' | 'preview' | 'verifying' | 'success' | 'declined'
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
    manageSubscription,
    isTeamPlan,
    resubscribe,
    subscription
  } = useBillingContext()
  const { shouldUseWorkspaceBilling } = useBillingRouting()
  const { permissions } = useWorkspaceUI()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()
  const workspaceStore = useTeamWorkspaceStore()

  // Re-entry: a pending 3DS charge owns the dialog. Opening with one lands
  // on the verifying step — the plan steps stay unreachable until the
  // operation resolves, is canceled, or its 24h link expires.
  const checkoutStep = ref<CheckoutStep>(
    billingOperationStore.subscriptionActionOperation ? 'verifying' : 'pricing'
  )
  const checkoutDeclineReason = ref<string | null>(null)
  const isCancelingPayment = ref(false)
  const cancelUnavailable = ref(false)
  const canceledNoticeVisible = ref(false)
  let canceledNoticeTimer: ReturnType<typeof setTimeout> | undefined
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedTeamCheckout = ref<SelectedTeamCheckout | null>(null)
  const selectedBillingCycle = ref<BillingCycle>('yearly')
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
  const isCancelled = computed(() => subscription.value?.isCancelled ?? false)

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

    // A cancelled subscriber picking Team is a reactivation even when
    // nothing existing is "changing" (isChange false, e.g. a first-time Team
    // pick): the add-payment screen this would otherwise fall back to can't
    // collect confirm_reactivation, so it always needs a real,
    // reactivation-capable preview instead of the consent-less fallback.
    const needsPreview = payload.isChange || isCancelled.value
    if (!needsPreview || !payload.stop.id) return

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

    if (isReactivationCapablePreview(response)) {
      previewData.value = response
      return
    }
    // Not cancelled: preview is best-effort, keep the display-only confirm.
    if (!isCancelled.value) return

    // Cancelled with no qualifying preview: the add-payment fallback has no
    // way to collect confirm_reactivation, so every submit from it would be
    // an unrecoverable dead end. Surface the failure instead.
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
  }

  function handleBackToPricing() {
    if (isPolling.value) return
    checkoutStep.value = 'pricing'
    previewData.value = null
    selectedTeamCheckout.value = null
    activeCheckoutOperationId.value = null
  }

  function handleSuccessClose() {
    emit('close', true)
  }

  async function handleSubscription(
    confirmReactivation = false,
    confirmationToken?: string,
    promotionCode?: string
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
      if (!confirmReactivation && isCancelled.value) {
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      if (confirmReactivation && isCancelled.value) {
        await assertReactivationAmountUnchanged(planSlug)
      }
      const response = await subscribe(planSlug, {
        ...(confirmationToken && { confirmationToken }),
        ...(promotionCode && { promotionCode }),
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
        paymentIntentSource
      }
    )
    if (
      activeCheckoutOperationId.value !== opId ||
      operation.workspaceId !== workspaceStore.activeWorkspaceId
    ) {
      return
    }
    if (operation.status === 'succeeded') {
      checkoutStep.value = 'success'
    } else if (operation.status === 'failed') {
      checkoutDeclineReason.value = operation.errorMessage
      checkoutStep.value = 'declined'
    }
  }

  async function handleUpdatePayment() {
    await manageSubscription()
  }

  function handleDeclinedBack() {
    checkoutDeclineReason.value = null
    checkoutStep.value = 'preview'
  }

  function showCanceledNotice() {
    canceledNoticeVisible.value = true
    if (canceledNoticeTimer) clearTimeout(canceledNoticeTimer)
    canceledNoticeTimer = setTimeout(() => {
      canceledNoticeVisible.value = false
    }, 5000)
  }

  onScopeDispose(() => {
    if (canceledNoticeTimer) clearTimeout(canceledNoticeTimer)
  })

  // Canceled is not failed: nothing persists, so from the in-flow pending
  // states the dialog stays on confirm with intent intact plus an inline
  // notice, while a re-entry cancel returns to plan selection (there is no
  // preserved intent to land on). 'unavailable' is the cancel-raced-the-bank
  // case — the cancel slot becomes a notice and polling finishes the story.
  async function handleCancelPendingPayment() {
    const operation = activeCheckoutOperation.value
    if (!operation || isCancelingPayment.value) return
    isCancelingPayment.value = true
    const result = await billingOperationStore.cancelOperation(operation.opId)
    isCancelingPayment.value = false
    if (result === 'unavailable') {
      cancelUnavailable.value = true
      return
    }
    activeCheckoutOperationId.value = null
    cancelUnavailable.value = false
    if (checkoutStep.value === 'verifying') {
      checkoutStep.value = 'pricing'
      return
    }
    showCanceledNotice()
  }

  // The verifying step is only entered on re-entry, where no subscribe call
  // is awaiting the operation — resolve it from here instead. Success with
  // no plan selection has nothing to show on the success step, so the dialog
  // closes and the store's success toast plus the refreshed plan UI carry
  // the outcome.
  watch(
    () => [checkoutStep.value, activeCheckoutOperation.value?.status] as const,
    ([step, status]) => {
      if (step !== 'verifying') return
      if (status === 'succeeded') {
        if (selectedTierKey.value || isTeamCheckout.value) {
          checkoutStep.value = 'success'
        } else {
          emit('close', true)
        }
        return
      }
      if (status === 'failed') {
        checkoutDeclineReason.value =
          activeCheckoutOperation.value?.errorMessage ?? null
        checkoutStep.value = 'declined'
        return
      }
      if (status === undefined) {
        checkoutStep.value = 'pricing'
      }
    }
  )

  async function handleTeamSubscription(
    confirmReactivation = false,
    confirmationToken?: string,
    promotionCode?: string
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
      if (!confirmReactivation && isCancelled.value) {
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
        return
      }
      if (confirmReactivation && isCancelled.value) {
        await assertReactivationAmountUnchanged(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
      }
      const response = await subscribe(planSlug, {
        ...(confirmationToken && { confirmationToken }),
        ...(promotionCode && { promotionCode }),
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

  function handleSubscriptionPayment(
    confirmationToken: string,
    promotionCode?: string
  ) {
    return handleSubscription(false, confirmationToken, promotionCode)
  }

  function handleTeamSubscriptionPayment(
    confirmationToken: string,
    promotionCode?: string
  ) {
    return handleTeamSubscription(false, confirmationToken, promotionCode)
  }

  return {
    checkoutStep,
    checkoutDeclineReason,
    handleDeclinedBack,
    handleUpdatePayment,
    isLoadingPreview,
    loadingTier,
    isSubscribing,
    isResubscribing,
    previewData,
    selectedTierKey,
    selectedTeamStop,
    selectedBillingCycle,
    activeCheckoutActionUrl,
    isPolling,
    isTeamCheckout,
    previewVariant,
    isCancelingPayment,
    cancelUnavailable,
    canceledNoticeVisible,
    handleCancelPendingPayment,
    handleSubscribeClick,
    handleSubscribeTeamClick,
    handleBackToPricing,
    handleSuccessClose,
    handleAddCreditCard: handleSubscription,
    handleConfirmTransition: handleSubscription,
    handleTeamSubscribe: handleTeamSubscription,
    handleSubscriptionPayment,
    handleTeamSubscriptionPayment,
    handleResubscribe
  }
}
