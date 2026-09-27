import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { paymentReturnUrl } from '@/platform/cloud/subscription/utils/paymentReturnUrl'
import { getTeamPlanSlug } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  PaymentIntentSource,
  SubscriptionCheckoutType
} from '@/platform/telemetry/types'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useAuthStore } from '@/stores/authStore'
import type {
  Plan,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SavedPaymentMethod,
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearPendingSubscriptionCheckoutIfTerminal,
  savePendingSubscriptionCheckout
} from '@/platform/workspace/utils/pendingSubscriptionCheckout'
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
      isChange?: boolean
    }

interface SelectedTeamCheckout {
  stop: TeamPlanSelection
  checkoutType: SubscriptionCheckoutType
}

interface SubscriptionCheckoutOptions {
  tierPlanType?: 'personal' | 'team'
  embeddedCheckoutEnabled?: boolean
}

type SubscriptionPaymentOptions = Pick<
  SubscribeOptions,
  | 'confirmationToken'
  | 'promotionCode'
  | 'quoteId'
  | 'quoteVersion'
  | 'savedPaymentMethodId'
>

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

function parseBillingPortalUrl(url: unknown): URL | null {
  if (typeof url !== 'string') return null
  try {
    const portalUrl = new URL(url)
    return portalUrl.origin === 'https://billing.stripe.com' ? portalUrl : null
  } catch {
    return null
  }
}

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
  {
    tierPlanType = 'personal',
    embeddedCheckoutEnabled = false
  }: SubscriptionCheckoutOptions = {}
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
  const { canSubscribeSelfServe, canChangeSeats, canDowngradeToPersonal } =
    useBillingCapabilities()
  const { permissions, canReactivatePlan } = useWorkspaceUI()
  const telemetry = useTelemetry()
  const billingOperationStore = useBillingOperationStore()
  const workspaceStore = useTeamWorkspaceStore()

  const checkoutStep = ref<CheckoutStep>('pricing')
  const isLoadingPreview = ref(false)
  const loadingTier = ref<CheckoutTierKey | null>(null)
  const isSubscribing = ref(false)
  const isApplyingPromotionCode = ref(false)
  const isResubscribing = ref(false)
  const previewData = ref<PreviewSubscribeResponse | null>(null)
  const quoteIsCurrent = ref(false)
  const savedPaymentMethods = ref<SavedPaymentMethod[]>([])
  const selectedSavedPaymentMethodId = ref<string | null>(null)
  const selectedTierKey = ref<CheckoutTierKey | null>(null)
  const selectedTeamCheckout = ref<SelectedTeamCheckout | null>(null)
  let teamPreviewRequestId = 0
  let promotionPreviewRequestId = 0
  let checkoutMutationLocked = false
  let refreshStatusOnFocus = false
  let activeCheckoutAttemptStartedAt: number | undefined
  useEventListener(window, 'focus', () => {
    if (!refreshStatusOnFocus) return
    refreshStatusOnFocus = false
    void fetchStatus()
  })
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
  const authenticationState = computed(
    () => activeCheckoutOperation.value?.authenticationState ?? null
  )
  const authenticationError = computed(
    () => activeCheckoutOperation.value?.errorMessage ?? null
  )
  const canRetryAuthentication = computed(
    () => activeCheckoutOperation.value?.canRetryAuthentication ?? false
  )
  const isAuthenticating = computed(
    () => activeCheckoutOperation.value?.isAuthenticating ?? false
  )
  const reconciliationOperationId = computed(() =>
    activeCheckoutOperation.value?.status === 'reconciliation_needed'
      ? activeCheckoutOperation.value.opId
      : null
  )
  // Busy from submit until the checkout presents a terminal step. A pending
  // operation only releases the confirm action while it is parked on the
  // customer (a challenge to complete, a failed attempt to retry); the
  // in-page challenge this tab drives keeps it busy, and a succeeded
  // operation stays busy for the beat between settlement and the success
  // step taking over — that beat reopened the pay button mid-checkout.
  const isPolling = computed(() => {
    const operation = activeCheckoutOperation.value
    if (!operation) return false
    if (operation.status === 'succeeded') return true
    if (operation.status !== 'pending') return false
    if (operation.isAuthenticating) return true
    return (
      operation.authenticationState !== 'failed_retryable' &&
      operation.authenticationState !== 'requires_action'
    )
  })
  function beginCheckoutMutation(): boolean {
    if (checkoutMutationLocked) return false
    checkoutMutationLocked = true
    return true
  }

  function finishCheckoutMutation() {
    checkoutMutationLocked = false
  }
  const selectedTeamStop = computed(
    () => selectedTeamCheckout.value?.stop ?? null
  )
  const isTeamCheckout = computed(() => selectedTeamCheckout.value !== null)
  function isSubscriptionCancelled(): boolean {
    return subscription.value?.isCancelled ?? false
  }

  function hasQuoteIdentity(
    preview: PreviewSubscribeResponse
  ): preview is PreviewSubscribeResponse & {
    quote_id: string
    quote_version: number
  } {
    return Boolean(preview.quote_id) && preview.quote_version !== undefined
  }

  function installPreview(preview: PreviewSubscribeResponse): boolean {
    if (!preview.allowed) return false
    previewData.value = preview
    if (embeddedCheckoutEnabled) {
      reactivationRequired.value =
        preview.requires_reactivation_confirmation ?? true
    }
    quoteIsCurrent.value = true
    return true
  }

  function requiresReactivationConfirmation(): boolean {
    if (embeddedCheckoutEnabled) {
      return previewData.value?.requires_reactivation_confirmation ?? true
    }
    return isSubscriptionCancelled() || reactivationRequired.value
  }

  // The transition workflows charge the subscription's existing default
  // method and reject a payment-method selection outright, so only an
  // initial-style checkout may carry the auto-selected saved method.
  function subscribeAcceptsSavedMethod(): boolean {
    return (
      !previewData.value ||
      previewData.value.transition_type === 'new_subscription'
    )
  }

  function buildPaymentOptions(
    quote: PreviewSubscribeResponse | null,
    confirmationToken?: string,
    promotionCode?: string
  ): SubscriptionPaymentOptions {
    return {
      ...(confirmationToken && { confirmationToken }),
      ...(!confirmationToken &&
        subscribeAcceptsSavedMethod() &&
        selectedSavedPaymentMethodId.value && {
          savedPaymentMethodId: selectedSavedPaymentMethodId.value
        }),
      promotionCode: quote?.promotion_code ?? promotionCode,
      ...(quote &&
        hasQuoteIdentity(quote) && {
          quoteId: quote.quote_id,
          quoteVersion: quote.quote_version
        })
    }
  }

  async function loadSavedPaymentMethods(): Promise<void> {
    if (!embeddedCheckoutEnabled || !shouldUseWorkspaceBilling.value) return
    try {
      const methods = await workspaceApi.listSavedPaymentMethods()
      savedPaymentMethods.value = methods
      selectedSavedPaymentMethodId.value =
        methods.find((method) => method.is_default)?.id ?? null
    } catch {
      savedPaymentMethods.value = []
      selectedSavedPaymentMethodId.value = null
    }
  }

  function invalidateQuote(): void {
    quoteIsCurrent.value = false
  }

  function withCurrentPromotion(
    options: PreviewSubscribeOptions = {}
  ): PreviewSubscribeOptions {
    const promotionCode = previewData.value?.promotion_code
    return {
      ...options,
      ...(promotionCode && { promotionCode })
    }
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
    const freshPreview = await previewSubscribe(
      planSlug,
      withCurrentPromotion(options)
    )
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
        installPreview(freshPreview)
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
    installPreview(freshPreview)
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

  async function recoverOutstandingPayment(
    error: unknown,
    isCurrent: () => boolean = () => true
  ) {
    let requiresRecovery =
      hasErrorCode(error, 'SUBSCRIPTION_PAYMENT_REQUIRED') ||
      hasErrorCode(error, 'OUTSTANDING_PAYMENT_REQUIRED')
    if (!requiresRecovery && hasErrorCode(error, 'TRANSITION_NOT_ALLOWED')) {
      try {
        requiresRecovery =
          (await workspaceApi.getBillingStatus()).billing_status ===
          'payment_failed'
      } catch {
        return null
      }
    }
    if (!requiresRecovery || !isCurrent()) return null

    try {
      const returnUrl = `${globalThis.location.origin}${globalThis.location.pathname}`
      const portalUrl = parseBillingPortalUrl(
        (await workspaceApi.getPaymentPortalUrl(returnUrl)).url
      )
      if (!isCurrent()) return null
      if (!portalUrl) {
        throw new Error(
          t('toastMessages.failedToAccessBillingPortal', {
            error: t('toastMessages.invalidBillingPortalUrl')
          })
        )
      }
      const paymentWindow = window.open(portalUrl.href, '_blank')
      if (!paymentWindow) {
        toast.add({
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('subscription.preview.paymentPopupBlocked')
        })
        return 'blocked'
      }
      refreshStatusOnFocus = true
      return 'opened'
    } catch (portalError) {
      if (!isCurrent()) return null
      showSubscribeError(portalError)
      return 'failed'
    }
  }

  async function refreshExpiredProrationQuote(
    error: unknown,
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<boolean> {
    if (!hasErrorCode(error, 'PRORATION_QUOTE_EXPIRED')) return false

    let freshPreview: PreviewSubscribeResponse | null
    try {
      freshPreview = await previewSubscribe(
        planSlug,
        withCurrentPromotion(options)
      )
    } catch (previewError) {
      if (!(await recoverOutstandingPayment(previewError))) {
        showSubscribeError(previewError)
      }
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
    installPreview(freshPreview)
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

  async function refreshPreviewOnReactivationBlock(
    planSlug: string,
    options?: PreviewSubscribeOptions
  ): Promise<void> {
    let freshPreview: PreviewSubscribeResponse | null = null
    try {
      freshPreview = await previewSubscribe(
        planSlug,
        withCurrentPromotion(options)
      )
    } catch (error) {
      const recovery = await recoverOutstandingPayment(error)
      if (recovery === 'failed') resetToPricing()
      if (recovery) return
      // Treated the same as an incapable preview below.
    }
    if (
      freshPreview?.requires_reactivation_confirmation !== false &&
      isReactivationCapablePreview(freshPreview)
    ) {
      installPreview(freshPreview)
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
      (isCloud
        ? canDowngradeToPersonal.value
        : permissions.value.canDowngradeToPersonal)
    )
  }

  function canPerformCheckout(checkoutType: SubscriptionCheckoutType): boolean {
    if (!isCloud) return permissions.value.canManageSubscription
    return checkoutType === 'change'
      ? canChangeSeats.value
      : canSubscribeSelfServe.value
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
      false
    )
    return true
  }

  const previewVariant = computed<PreviewVariant>(() => {
    if (selectedTeamCheckout.value) {
      return selectedTeamCheckout.value.checkoutType === 'change' ||
        (previewData.value &&
          previewData.value.transition_type !== 'new_subscription')
        ? 'team-change'
        : 'team-new'
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
      !canSelectTierPlan() ||
      (isTeamPlan.value && tierPlanType !== 'team'
        ? !(isCloud
            ? canDowngradeToPersonal.value
            : permissions.value.canDowngradeToPersonal)
        : isCloud && !canSubscribeSelfServe.value && !canChangeSeats.value)
    ) {
      return
    }

    const { tierKey, billingCycle } = payload
    promotionPreviewRequestId += 1

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
      const response = embeddedCheckoutEnabled
        ? (
            await Promise.all([
              previewSubscribe(planSlug),
              loadSavedPaymentMethods()
            ])
          )[0]
        : await previewSubscribe(planSlug)

      if (!response || !response.allowed) {
        toast.add({
          severity: 'error',
          summary: 'Unable to subscribe',
          detail: response?.reason || 'This plan is not available'
        })
        return
      }
      const checkoutType =
        response.transition_type === 'new_subscription' ? 'new' : 'change'
      if (!canPerformCheckout(checkoutType)) return

      installPreview(response)
      checkoutStep.value = 'preview'
    } catch (error) {
      if (await recoverOutstandingPayment(error)) return
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
    const checkoutType = payload.isChange ? 'change' : 'new'
    if (isSubscribing.value || !canPerformCheckout(checkoutType)) return

    const previewRequestId = ++teamPreviewRequestId
    promotionPreviewRequestId += 1
    reactivationRequired.value = false
    selectedTeamCheckout.value = {
      stop: payload.stop,
      checkoutType
    }
    selectedBillingCycle.value = payload.billingCycle
    selectedTierKey.value = null
    previewData.value = null
    quoteIsCurrent.value = false

    if (!embeddedCheckoutEnabled) {
      checkoutStep.value = 'preview'
      const needsPreview = payload.isChange || isSubscriptionCancelled()
      isLoadingPreview.value = needsPreview && !!payload.stop.id
      if (!needsPreview || !payload.stop.id) return

      let response: PreviewSubscribeResponse | null = null
      let previewError: unknown
      try {
        response = await previewSubscribe(
          getTeamPlanSlug(payload.billingCycle),
          {
            teamCreditStopId: payload.stop.id
          }
        )
      } catch (error) {
        previewError = error
        const recovery = await recoverOutstandingPayment(
          error,
          () => previewRequestId === teamPreviewRequestId
        )
        if (recovery === 'failed') {
          resetToPricing()
          return
        }
        if (recovery) return
      } finally {
        if (previewRequestId === teamPreviewRequestId) {
          isLoadingPreview.value = false
        }
      }

      if (previewRequestId !== teamPreviewRequestId) return
      if (
        (isSubscriptionCancelled() && isReactivationCapablePreview(response)) ||
        (!isSubscriptionCancelled() && isExistingPlanPreview(response))
      ) {
        if (response) installPreview(response)
        return
      }
      if (!isSubscriptionCancelled()) return
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
      return
    }

    if (!payload.stop.id) return
    isLoadingPreview.value = true

    let response: PreviewSubscribeResponse | null = null
    let previewError: unknown
    try {
      const planSlug = getTeamPlanSlug(payload.billingCycle)
      ;[response] = await Promise.all([
        previewSubscribe(planSlug, {
          teamCreditStopId: payload.stop.id
        }),
        loadSavedPaymentMethods()
      ])
    } catch (error) {
      previewError = error
      const recovery = await recoverOutstandingPayment(
        error,
        () => previewRequestId === teamPreviewRequestId
      )
      if (recovery === 'failed') {
        resetToPricing()
        return
      }
      if (recovery) return
    } finally {
      if (previewRequestId === teamPreviewRequestId) {
        isLoadingPreview.value = false
      }
    }

    if (previewRequestId !== teamPreviewRequestId) return

    if (
      response?.allowed &&
      (response.requires_reactivation_confirmation === false ||
        isReactivationCapablePreview(response))
    ) {
      installPreview(response)
      checkoutStep.value = 'preview'
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
  }

  function resetToPricing() {
    teamPreviewRequestId += 1
    promotionPreviewRequestId += 1
    isLoadingPreview.value = false
    reactivationRequired.value = false
    checkoutStep.value = 'pricing'
    previewData.value = null
    quoteIsCurrent.value = false
    selectedTeamCheckout.value = null
    activeCheckoutOperationId.value = null
    activeCheckoutAttemptStartedAt = undefined
  }

  function handleBackToPricing() {
    if (isPolling.value || isSubscribing.value) return
    resetToPricing()
  }

  function handleSuccessClose() {
    emit('close', true)
  }

  async function handleSubscription(
    confirmReactivation = false,
    confirmationToken?: string,
    promotionCode?: string
  ) {
    if (!canSelectTierPlan()) return
    if (!beginCheckoutMutation()) return

    const tierKey = selectedTierKey.value
    if (!tierKey) {
      finishCheckoutMutation()
      return
    }

    const billingCycle = selectedBillingCycle.value
    const planSlug = getApiPlanSlug(tierKey, billingCycle)
    if (!planSlug) {
      finishCheckoutMutation()
      return
    }
    const checkoutType =
      previewData.value &&
      previewData.value.transition_type !== 'new_subscription'
        ? 'change'
        : 'new'
    if (!canPerformCheckout(checkoutType)) {
      finishCheckoutMutation()
      return
    }

    isSubscribing.value = true
    try {
      if (await showTeamToPersonalDowngrade(planSlug, tierKey)) return
      await fetchStatus()
      if (!confirmReactivation && requiresReactivationConfirmation()) {
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      const attemptStartedAt = trackSubscriptionStarted({
        tier: tierKey,
        cycle: billingCycle,
        checkoutType
      })
      if (confirmReactivation && requiresReactivationConfirmation()) {
        await assertReactivationAmountUnchanged(planSlug)
      }
      const quote = embeddedCheckoutEnabled ? previewData.value : null
      if (embeddedCheckoutEnabled && quote && !quoteIsCurrent.value) {
        throw new Error(t('subscription.preview.applyQuoteBeforeContinuing'))
      }
      const response = await subscribe(planSlug, {
        ...(embeddedCheckoutEnabled &&
          buildPaymentOptions(quote, confirmationToken, promotionCode)),
        returnUrl: embeddedCheckoutEnabled
          ? paymentReturnUrl()
          : `${getComfyPlatformBaseUrl()}/payment/success`,
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
        checkoutType,
        attemptStartedAt
      })
      activeCheckoutAttemptStartedAt = undefined
    } catch (error) {
      if (hasErrorCode(error, 'REACTIVATION_CONFIRMATION_REQUIRED')) {
        await refreshPreviewOnReactivationBlock(planSlug)
        return
      }
      trackSubscriptionFailure(
        {
          tier: tierKey,
          cycle: billingCycle,
          checkoutType,
          attemptStartedAt: activeCheckoutAttemptStartedAt
        },
        error
      )
      activeCheckoutAttemptStartedAt = undefined
      if (await recoverOutstandingPayment(error)) return
      if (await refreshExpiredProrationQuote(error, planSlug)) return
      if (embeddedCheckoutEnabled && (await recoverStaleQuote(error))) return
      showSubscribeError(error)
    } finally {
      isSubscribing.value = false
      finishCheckoutMutation()
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

  async function recoverStaleQuote(error: unknown): Promise<boolean> {
    if (!hasErrorCode(error, 'SUBSCRIPTION_QUOTE_STALE')) return false
    quoteIsCurrent.value = false
    const refreshed = await applyPromotionCode(
      previewData.value?.promotion_code ?? '',
      false,
      false
    )
    if (!refreshed) {
      resetToPricing()
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('subscription.preview.quoteRefreshFailed')
      })
      return true
    }
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('subscription.preview.quoteStale')
    })
    return true
  }

  async function applyPromotionCode(
    promotionCode: string,
    showFailure = true,
    lockMutation = true
  ): Promise<boolean> {
    if (!embeddedCheckoutEnabled) return false
    if (lockMutation && !beginCheckoutMutation()) return false
    isApplyingPromotionCode.value = true
    const requestId = ++promotionPreviewRequestId
    const normalizedInput = promotionCode.trim()
    let planSlug: string | null
    let options: PreviewSubscribeOptions
    if (selectedTeamCheckout.value?.stop.id) {
      planSlug = getTeamPlanSlug(selectedBillingCycle.value)
      options = {
        teamCreditStopId: selectedTeamCheckout.value.stop.id,
        ...(normalizedInput && { promotionCode: normalizedInput })
      }
    } else if (selectedTierKey.value) {
      planSlug = getApiPlanSlug(
        selectedTierKey.value,
        selectedBillingCycle.value
      )
      options = normalizedInput ? { promotionCode: normalizedInput } : {}
    } else {
      if (lockMutation) finishCheckoutMutation()
      isApplyingPromotionCode.value = false
      return false
    }
    if (!planSlug) {
      if (lockMutation) finishCheckoutMutation()
      isApplyingPromotionCode.value = false
      return false
    }
    quoteIsCurrent.value = false
    try {
      const response = await previewSubscribe(planSlug, options)
      if (!response?.allowed) {
        throw new Error(response?.reason || t('subscription.subscribeFailed'))
      }
      if (requestId !== promotionPreviewRequestId) return false
      installPreview(response)
      return true
    } catch (error) {
      if (requestId !== promotionPreviewRequestId) return false
      if (showFailure) showSubscribeError(error)
      return false
    } finally {
      if (requestId === promotionPreviewRequestId) {
        isApplyingPromotionCode.value = false
      }
      if (lockMutation) finishCheckoutMutation()
    }
  }

  interface SubscriptionOutcomeContext {
    tier: CheckoutTierKey | 'team'
    cycle: BillingCycle
    checkoutType: SubscriptionCheckoutType
    /**
     * Timestamp captured alongside the canonical `subscription_checkout`
     * `started` event, threaded through to the billing-op poller so its
     * `duration_ms` spans the full attempt (including the initiating
     * subscribe call), not just the poll-observation window.
     */
    attemptStartedAt?: number
  }

  function trackSubscriptionStarted(
    context: SubscriptionOutcomeContext
  ): number | undefined {
    if (activeCheckoutAttemptStartedAt !== undefined) {
      return activeCheckoutAttemptStartedAt
    }
    if (!shouldUseWorkspaceBilling.value) return undefined

    activeCheckoutAttemptStartedAt = Date.now()

    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'started',
      outcome: 'pending',
      tier: context.tier,
      cycle: context.cycle,
      checkout_type: context.checkoutType,
      payment_intent_source: paymentIntentSource
    })
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'started',
      outcome: 'pending',
      operation_type: 'subscription',
      tier: context.tier,
      cycle: context.cycle,
      checkout_type: context.checkoutType,
      payment_intent_source: paymentIntentSource
    })
    return activeCheckoutAttemptStartedAt
  }

  function trackSubscriptionFailure(
    context: SubscriptionOutcomeContext,
    error?: unknown,
    errorCode?: 'missing_checkout_response'
  ) {
    if (context.attemptStartedAt === undefined) return

    // No checkout_url is a malformed response, not a caught error — 'unknown' is honest here.
    const failureCategory = errorCode
      ? 'unknown'
      : categorizeBillingApiError(error)

    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: context.tier,
      cycle: context.cycle,
      checkout_type: context.checkoutType,
      payment_intent_source: paymentIntentSource,
      failure_category: failureCategory,
      ...(errorCode && { error_code: errorCode }),
      duration_ms: Date.now() - context.attemptStartedAt
    })
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      operation_type: 'subscription',
      tier: context.tier,
      cycle: context.cycle,
      checkout_type: context.checkoutType,
      payment_intent_source: paymentIntentSource,
      failure_category: failureCategory,
      ...(errorCode && { error_code: errorCode }),
      duration_ms: Date.now() - context.attemptStartedAt
    })
  }

  async function handleSubscribeResponse(
    response: SubscribeResponse | void,
    context: SubscriptionOutcomeContext,
    shouldTrackSubscriptionSuccess = true
  ): Promise<void> {
    if (!response) {
      trackSubscriptionFailure(context, undefined, 'missing_checkout_response')
      return
    }

    if (response.status === 'subscribed') {
      if (
        shouldTrackSubscriptionSuccess &&
        context.attemptStartedAt !== undefined
      ) {
        const durationMs = Date.now() - context.attemptStartedAt
        // PostHog implements both trackBillingEvent and
        // trackMonthlySubscriptionSucceeded (PostHogTelemetryProvider.ts:405,
        // :444), so also calling the legacy event here would double-count this
        // success for it. billingOperationStore.ts's own success handler
        // already restores trackMonthlySubscriptionSucceeded for the
        // providers that need it (Mixpanel, GTM); this call site doesn't need
        // a second one.
        telemetry?.trackBillingEvent({
          operation: 'subscription_checkout',
          stage: 'succeeded',
          outcome: 'success',
          tier: context.tier,
          cycle: context.cycle,
          checkout_type: context.checkoutType,
          payment_intent_source: paymentIntentSource,
          billing_op_id: response.billing_op_id,
          duration_ms: durationMs
        })
        telemetry?.trackBillingEvent({
          operation: 'operation',
          stage: 'succeeded',
          outcome: 'success',
          operation_type: 'subscription',
          tier: context.tier,
          cycle: context.cycle,
          checkout_type: context.checkoutType,
          payment_intent_source: paymentIntentSource,
          billing_op_id: response.billing_op_id,
          duration_ms: durationMs
        })
      }
      checkoutStep.value = 'success'
      return
    }

    savePendingCheckout(response.billing_op_id, context)

    let initialActionUrl: string | undefined
    if (response.status === 'needs_payment_method') {
      if (!response.payment_method_url) {
        throw new Error(t('subscription.preview.stripeUnavailable'))
      }
      initialActionUrl = response.payment_method_url
      // The open runs after `await subscribe(...)`, so it's not a direct user
      // gesture and can be popup-blocked; warn instead of failing silently.
      const paymentWindow = window.open(initialActionUrl, '_blank')
      if (!paymentWindow) {
        toast.add({
          severity: 'warn',
          summary: t('g.warning'),
          detail: t('subscription.preview.paymentPopupBlocked')
        })
      }
    }
    await advanceToSuccessOnOperation(
      response.billing_op_id,
      context,
      initialActionUrl
    )
  }

  function savePendingCheckout(
    operationId: string,
    context: SubscriptionOutcomeContext
  ): void {
    const workspaceId = workspaceStore.activeWorkspaceId
    const ownerUid = useAuthStore().userId
    if (!workspaceId || !ownerUid) return
    const attemptedAt = context.attemptStartedAt ?? Date.now()

    if (context.tier === 'team') {
      const teamCreditStopId = selectedTeamCheckout.value?.stop.id
      if (!teamCreditStopId) return
      savePendingSubscriptionCheckout({
        operationId,
        workspaceId,
        ownerUid,
        selection: {
          planMode: 'team',
          teamCreditStopId,
          billingCycle: context.cycle
        },
        attemptedAt
      })
      return
    }

    savePendingSubscriptionCheckout({
      operationId,
      workspaceId,
      ownerUid,
      selection: {
        planMode: 'personal',
        tierKey: context.tier,
        billingCycle: context.cycle
      },
      attemptedAt
    })
  }

  // A Stripe-backed subscribe finishes asynchronously: await the billing op and
  // advance to the success step ourselves. The store refreshes status/balance
  // before resolving and surfaces any failure via toast.
  async function advanceToSuccessOnOperation(
    opId: string,
    context: SubscriptionOutcomeContext,
    initialActionUrl?: string
  ) {
    activeCheckoutOperationId.value = opId
    const metadata = {
      tier: context.tier,
      cycle: context.cycle,
      checkoutType: context.checkoutType,
      paymentIntentSource,
      attemptStartedAt: context.attemptStartedAt,
      ...(embeddedCheckoutEnabled && {
        suppressProcessingToast: true,
        autoHandleRequiresAction: true
      })
    }
    const terminalOperation = initialActionUrl
      ? billingOperationStore.startOperation(
          opId,
          'subscription',
          metadata,
          initialActionUrl
        )
      : billingOperationStore.startOperation(opId, 'subscription', metadata)
    if (embeddedCheckoutEnabled) isSubscribing.value = false
    const operation = await terminalOperation
    clearPendingSubscriptionCheckoutIfTerminal(opId, operation.status)
    if (
      operation.status === 'succeeded' &&
      activeCheckoutOperationId.value === opId &&
      operation.workspaceId === workspaceStore.activeWorkspaceId
    ) {
      checkoutStep.value = 'success'
    }
  }

  async function retryPaymentAuthentication() {
    const opId = activeCheckoutOperation.value?.opId
    if (!opId) return
    await billingOperationStore.retryPaymentAuthentication(opId)
  }

  async function handleTeamSubscription(
    confirmReactivation = false,
    confirmationToken?: string,
    promotionCode?: string
  ) {
    if (
      isLoadingPreview.value ||
      isSubscribing.value ||
      !selectedTeamCheckout.value ||
      !canPerformCheckout(selectedTeamCheckout.value.checkoutType)
    ) {
      return
    }
    if (!beginCheckoutMutation()) return

    const teamCheckout = selectedTeamCheckout.value
    if (!teamCheckout?.stop.id) {
      toast.add({
        severity: 'error',
        summary: t('subscription.teamPlan.name'),
        detail: t('subscription.teamPlan.unavailable')
      })
      finishCheckoutMutation()
      return
    }

    const { stop, checkoutType } = teamCheckout
    const billingCycle = selectedBillingCycle.value
    const planSlug = getTeamPlanSlug(billingCycle)

    isSubscribing.value = true
    try {
      await fetchStatus()
      if (!confirmReactivation && requiresReactivationConfirmation()) {
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id
        })
        return
      }
      const attemptStartedAt = trackSubscriptionStarted({
        tier: 'team',
        cycle: billingCycle,
        checkoutType
      })
      if (confirmReactivation && requiresReactivationConfirmation()) {
        await assertReactivationAmountUnchanged(planSlug, {
          teamCreditStopId: stop.id
        })
      }
      const quote = embeddedCheckoutEnabled ? previewData.value : null
      if (embeddedCheckoutEnabled && quote && !quoteIsCurrent.value) {
        throw new Error(t('subscription.preview.applyQuoteBeforeContinuing'))
      }
      const response = await subscribe(planSlug, {
        ...(embeddedCheckoutEnabled &&
          buildPaymentOptions(quote, confirmationToken, promotionCode)),
        teamCreditStopId: stop.id,
        billingCycle,
        returnUrl: embeddedCheckoutEnabled
          ? paymentReturnUrl()
          : `${getComfyPlatformBaseUrl()}/payment/success`,
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
        checkoutType,
        attemptStartedAt
      })
      activeCheckoutAttemptStartedAt = undefined
    } catch (error) {
      if (hasErrorCode(error, 'REACTIVATION_CONFIRMATION_REQUIRED')) {
        await refreshPreviewOnReactivationBlock(planSlug, {
          teamCreditStopId: stop.id
        })
        return
      }
      trackSubscriptionFailure(
        {
          tier: 'team',
          cycle: billingCycle,
          checkoutType,
          attemptStartedAt: activeCheckoutAttemptStartedAt
        },
        error
      )
      activeCheckoutAttemptStartedAt = undefined
      if (await recoverOutstandingPayment(error)) return
      if (
        await refreshExpiredProrationQuote(error, planSlug, {
          teamCreditStopId: stop.id
        })
      )
        return
      if (embeddedCheckoutEnabled && (await recoverStaleQuote(error))) return
      showSubscribeError(error)
    } finally {
      isSubscribing.value = false
      finishCheckoutMutation()
    }
  }

  async function handleResubscribe() {
    if (!canReactivatePlan.value) return

    const source = 'pricing_dialog' as const

    telemetry?.trackResubscribeClicked({
      source,
      payment_intent_source: paymentIntentSource
    })
    // Emitted before the awaited call so a failure always has a preceding
    // `started` — emitting it only after the call meant a failure produced a
    // `failed` with no matching `started`, pushing failed/started over 100%.
    telemetry?.trackBillingEvent({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source,
      payment_intent_source: paymentIntentSource
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
        telemetry?.trackBillingEvent({
          operation: 'resubscribe',
          stage: 'succeeded',
          outcome: 'success',
          source,
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
      telemetry?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source,
        payment_intent_source: paymentIntentSource,
        failure_category: categorizeBillingApiError(error)
      })
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
    isLoadingPreview,
    loadingTier,
    isSubscribing,
    isApplyingPromotionCode,
    isResubscribing,
    previewData,
    reactivationRequired,
    quoteIsCurrent,
    savedPaymentMethods,
    selectedSavedPaymentMethodId,
    selectedTierKey,
    selectedTeamStop,
    selectedBillingCycle,
    activeCheckoutActionUrl,
    authenticationState,
    authenticationError,
    canRetryAuthentication,
    isAuthenticating,
    reconciliationOperationId,
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
    retryPaymentAuthentication,
    applyPromotionCode,
    invalidateQuote,
    handleResubscribe
  }
}
