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
  SubscribeResponse
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
 * carries `previewData`, a personal change is anything other than `new_subscription`;
 * the rest are display-only fresh-subscribe confirms.
 */
type PreviewVariant =
  | 'team-change'
  | 'team-new'
  | 'personal-change'
  | 'personal-new'
  | null

/** Thrown by `assertReactivationAmountUnchanged` when a fresh preview no
 *  longer matches the billing state the reactivation banner showed and the
 *  user consented to. Caught by the surrounding try/catch and surfaced
 *  through the same toast as any other subscribe failure. */
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
  let teamPreviewRequestId = 0
  // Some legacy-rail status reads cannot expose a scheduled cancellation even
  // though the subscribe authority can see it in Stripe. Once that authority
  // rejects an unconfirmed change, keep the consent screen in reactivation
  // mode until the user backs out or completes the change.
  const reactivationRequired = ref(false)
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

  function isExistingPlanPreview(
    preview: PreviewSubscribeResponse | null | undefined
  ): preview is PreviewSubscribeResponse & { allowed: true } {
    return !!preview?.allowed && preview.transition_type !== 'new_subscription'
  }

  function isReactivationCapablePreview(
    preview: PreviewSubscribeResponse | null | undefined
  ): preview is PreviewSubscribeResponse & { allowed: true } {
    return (
      isExistingPlanPreview(preview) &&
      !!preview.current_plan &&
      !!(subscription.value?.endDate ?? preview.current_plan.period_end)
    )
  }

  function reactivationMaterialSnapshot(
    preview: PreviewSubscribeResponse,
    ignoreTimeDerivedTodayValues = false
  ): string {
    const planSnapshot = (
      plan: PreviewSubscribeResponse['new_plan'] | undefined
    ) =>
      plan
        ? [
            plan.slug,
            plan.tier,
            plan.duration,
            plan.price_cents,
            plan.credits_cents,
            plan.seat_summary?.seat_count,
            plan.seat_summary?.total_cost_cents,
            plan.seat_summary?.total_credits_cents,
            plan.period_start,
            plan.period_end
          ]
        : null

    return JSON.stringify([
      preview.allowed,
      preview.transition_type,
      preview.is_immediate,
      preview.is_immediate ? null : preview.effective_at,
      preview.cost_next_period_cents,
      ignoreTimeDerivedTodayValues ? null : preview.credits_today_cents,
      preview.credits_next_period_cents,
      planSnapshot(preview.current_plan),
      planSnapshot(preview.new_plan)
    ])
  }

  // Current backends return the exact proration instant used for the preview;
  // subscribe() echoes it back so the charge cannot drift while the consent
  // screen is open. A fresh preview still checks non-time-based plan, quantity,
  // credit, and period state before the charge is submitted.
  async function assertReactivationAmountUnchanged(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<void> {
    const confirmedPreview = previewData.value
    const freshPreview = await previewSubscribe(planSlug, options)
    if (!freshPreview?.allowed) {
      throw new Error(freshPreview?.reason || t('subscription.subscribeFailed'))
    }

    if (confirmedPreview?.proration_at) {
      const isImmediateTransition = confirmedPreview.is_immediate
      const amountChanged = isImmediateTransition
        ? freshPreview.cost_today_cents > confirmedPreview.cost_today_cents
        : freshPreview.cost_today_cents !== confirmedPreview.cost_today_cents
      const materialChanged =
        reactivationMaterialSnapshot(freshPreview, isImmediateTransition) !==
        reactivationMaterialSnapshot(confirmedPreview, isImmediateTransition)
      if (amountChanged || materialChanged) {
        previewData.value = freshPreview
        throw new ReactivationAmountChangedError(
          t(
            amountChanged
              ? 'subscription.preview.reactivation.amountChanged'
              : 'subscription.preview.reactivation.confirmationRequired'
          )
        )
      }
      return
    }

    const amountChanged =
      freshPreview.cost_today_cents !==
      (confirmedPreview?.cost_today_cents ?? 0)
    const materialChanged =
      !!confirmedPreview &&
      reactivationMaterialSnapshot(freshPreview) !==
        reactivationMaterialSnapshot(confirmedPreview)
    // Install regardless of outcome: on drift this is what makes the confirm
    // screen show the new amount and resets prior consent (via the
    // component's own preview watcher), so the next attempt compares
    // against what's on screen instead of repeating this same failure.
    previewData.value = freshPreview
    if (amountChanged || materialChanged) {
      throw new ReactivationAmountChangedError(
        t(
          amountChanged
            ? 'subscription.preview.reactivation.amountChanged'
            : 'subscription.preview.reactivation.confirmationRequired'
        )
      )
    }
  }

  function hasErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    )
  }

  async function refreshExpiredProrationQuote(
    error: unknown,
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<boolean> {
    if (!hasErrorCode(error, 'PRORATION_QUOTE_EXPIRED')) return false

    let freshPreview: PreviewSubscribeResponse | null
    try {
      freshPreview = await previewSubscribe(planSlug, options)
    } catch (previewError) {
      showSubscribeError(previewError)
      return true
    }
    if (!isReactivationCapablePreview(freshPreview)) {
      resetToPricing()
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('subscription.preview.reactivation.unavailable')
      })
      return true
    }

    const amountChanged =
      freshPreview.cost_today_cents !== previewData.value?.cost_today_cents
    previewData.value = freshPreview
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t(
        amountChanged
          ? 'subscription.preview.reactivation.amountChanged'
          : 'subscription.preview.reactivation.confirmationRequired'
      )
    })
    return true
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
      reactivationRequired.value = true
      notifyReactivationConfirmationRequired()
      return
    }
    reactivationRequired.value = false
    resetToPricing()
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
    if (
      isSubscribing.value ||
      !permissions.value.canManageSubscription ||
      !canSelectTierPlan()
    ) {
      return
    }

    const { tierKey, billingCycle } = payload

    reactivationRequired.value = false
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
    if (isSubscribing.value || !permissions.value.canManageSubscription) return

    const previewRequestId = ++teamPreviewRequestId
    reactivationRequired.value = false
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
    isLoadingPreview.value = needsPreview && !!payload.stop.id
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
    } finally {
      if (previewRequestId === teamPreviewRequestId) {
        isLoadingPreview.value = false
      }
    }

    if (previewRequestId !== teamPreviewRequestId) return

    if (
      (isCancelled.value && isReactivationCapablePreview(response)) ||
      (!isCancelled.value && isExistingPlanPreview(response))
    ) {
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

  function resetToPricing() {
    teamPreviewRequestId += 1
    isLoadingPreview.value = false
    reactivationRequired.value = false
    checkoutStep.value = 'pricing'
    previewData.value = null
    selectedTeamCheckout.value = null
    activeCheckoutOperationId.value = null
  }

  function handleBackToPricing() {
    if (isPolling.value || isSubscribing.value) return
    resetToPricing()
  }

  function handleSuccessClose() {
    emit('close', true)
  }

  async function handleSubscription(confirmReactivation = false) {
    if (!permissions.value.canManageSubscription || !canSelectTierPlan()) return

    const tierKey = selectedTierKey.value
    if (!tierKey) return

    const billingCycle = selectedBillingCycle.value
    const planSlug = getApiPlanSlug(tierKey, billingCycle)
    if (!planSlug) return
    const checkoutType =
      previewData.value &&
      previewData.value.transition_type !== 'new_subscription'
        ? 'change'
        : 'new'

    isSubscribing.value = true
    try {
      if (await showTeamToPersonalDowngrade(planSlug, tierKey)) return
      await fetchStatus()
      if (
        !confirmReactivation &&
        (isCancelled.value || reactivationRequired.value)
      ) {
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      if (
        confirmReactivation &&
        (isCancelled.value || reactivationRequired.value)
      ) {
        await assertReactivationAmountUnchanged(planSlug)
      }
      const response = await subscribe(planSlug, {
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        confirmReactivation,
        prorationAt: previewData.value?.is_immediate
          ? previewData.value.proration_at
          : undefined
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
      if (hasErrorCode(error, 'REACTIVATION_CONFIRMATION_REQUIRED')) {
        trackSubscriptionFailure({
          tier: tierKey,
          cycle: billingCycle,
          checkoutType
        })
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      if (await refreshExpiredProrationQuote(error, planSlug)) {
        trackSubscriptionFailure({
          tier: tierKey,
          cycle: billingCycle,
          checkoutType
        })
        return
      }
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
      operation.status === 'succeeded' &&
      activeCheckoutOperationId.value === opId &&
      operation.workspaceId === workspaceStore.activeWorkspaceId
    ) {
      checkoutStep.value = 'success'
    }
  }

  async function handleTeamSubscription(confirmReactivation = false) {
    if (
      isLoadingPreview.value ||
      isSubscribing.value ||
      !permissions.value.canManageSubscription
    ) {
      return
    }

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
      if (
        !confirmReactivation &&
        (isCancelled.value || reactivationRequired.value)
      ) {
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
        return
      }
      if (
        confirmReactivation &&
        (isCancelled.value || reactivationRequired.value)
      ) {
        await assertReactivationAmountUnchanged(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
      }
      const response = await subscribe(planSlug, {
        teamCreditStopId: stop.id,
        billingCycle,
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
        confirmReactivation,
        prorationAt: previewData.value?.is_immediate
          ? previewData.value.proration_at
          : undefined
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
      if (hasErrorCode(error, 'REACTIVATION_CONFIRMATION_REQUIRED')) {
        trackSubscriptionFailure({
          tier: 'team',
          cycle: billingCycle,
          checkoutType
        })
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
        return
      }
      if (
        await refreshExpiredProrationQuote(error, planSlug, {
          teamCreditStopId: stop.id,
          billingCycle
        })
      ) {
        trackSubscriptionFailure({
          tier: 'team',
          cycle: billingCycle,
          checkoutType
        })
        return
      }
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

  return {
    checkoutStep,
    isLoadingPreview,
    loadingTier,
    isSubscribing,
    isResubscribing,
    previewData,
    reactivationRequired,
    selectedTierKey,
    selectedTeamStop,
    selectedBillingCycle,
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
    handleResubscribe
  }
}
