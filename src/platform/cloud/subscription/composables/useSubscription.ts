import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  createSharedComposable,
  defaultDocument,
  defaultWindow,
  useEventListener
} from '@vueuse/core'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { getComfyApiBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { webSessionResourceHeader } from '@/platform/auth/session/webSessionFetch'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { reportError as reportTelemetryError } from '@/platform/telemetry/reportError'
import type { SubscriptionDialogOptions } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type {
  CheckoutAttributionMetadata,
  ResubscribeClickMetadata,
  SubscriptionSuccessMetadata
} from '@/platform/telemetry/types'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { readOnRail } from '@/platform/workspace/composables/readOnRail'
import { useBillingReadRail } from '@/platform/workspace/composables/useBillingReadRail'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { platformLink } from '@/platform/workspace/utils/platformLink'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useDialogService } from '@/services/dialogService'
import { toTierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { operations } from '@/types/comfyRegistryTypes'
import { parseErrorResponse } from '@/platform/remote/comfyui/errors'
import {
  PENDING_SUBSCRIPTION_CHECKOUT_EVENT,
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
  getPendingSubscriptionCheckoutAttempt,
  hasPendingSubscriptionCheckoutAttempt,
  hasReportedMissingCheckoutCompletion,
  hasReportedRecoveryUnreachable,
  markMissingCheckoutCompletionReported,
  markRecoveryUnreachableReported,
  recordPendingSubscriptionCheckoutAttempt
} from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { useSubscriptionCancellationWatcher } from './useSubscriptionCancellationWatcher'

type CloudSubscriptionCheckoutResponse = NonNullable<
  operations['createCloudSubscriptionCheckout']['responses']['201']['content']['application/json']
>

const PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS = [3000, 10000, 30000]

/** The ladder above exhausts 43s after the checkout tab opens, well inside the
 * time a real user spends on card entry and 3DS. */
const PENDING_CHECKOUT_COMPLETION_DEADLINE_MS = 10 * 60 * 1000
const PENDING_CHECKOUT_DEADLINE_REFRESH_TIMEOUT_MS = 10_000
const PENDING_CHECKOUT_DEADLINE_RETRY_DELAYS_MS = [
  1000,
  5000,
  30000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000
] as const
const MAX_TIMER_DELAY_MS = 2_147_483_647

type CheckoutScopeOwnership = 'unresolved' | 'matched' | 'mismatched'

function compareCheckoutScopeStamp(
  stampedId: string | null | undefined,
  currentId: string | null | undefined
): CheckoutScopeOwnership {
  if (typeof stampedId !== 'string') return 'matched'
  if (!currentId) return 'unresolved'
  return stampedId === currentId ? 'matched' : 'mismatched'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Billing status deadline refresh timed out')),
          timeoutMs
        )
      })
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

function useSubscriptionInternal() {
  const subscriptionStatus = ref<BillingStatusResponse | null>(null)
  const telemetry = useTelemetry()
  const isInitialized = ref(false)

  const canAccessSubscriptionFeatures = computed(() => {
    if (!isCloud || !window.__CONFIG__?.subscription_required) return true

    return subscriptionStatus.value?.is_active ?? false
  })
  const { reportError, accessBillingPortal } = useAuthActions()
  const { showSubscriptionRequiredDialog } = useDialogService()

  const authStore = useAuthStore()
  const workspaceStore = useTeamWorkspaceStore()
  const { getFirebaseAuthHeader, fetchWithCustomerRecovery } = authStore
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const { isLoggedIn } = useCurrentUser()

  const isCancelled = computed(() => {
    return !!subscriptionStatus.value?.cancel_at
  })

  const formattedRenewalDate = computed(() => {
    if (!subscriptionStatus.value?.renewal_date) return ''

    const renewalDate = new Date(subscriptionStatus.value.renewal_date)

    return renewalDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const formattedEndDate = computed(() => {
    if (!subscriptionStatus.value?.cancel_at) return ''

    const endDate = new Date(subscriptionStatus.value.cancel_at)

    return endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  })

  const subscriptionTier = computed(
    () => subscriptionStatus.value?.subscription_tier ?? null
  )

  const isFreeTier = computed(() => subscriptionTier.value === 'FREE')

  const subscriptionDuration = computed(
    () => subscriptionStatus.value?.subscription_duration ?? null
  )

  const isYearlySubscription = computed(
    () => subscriptionDuration.value === 'ANNUAL'
  )

  const subscriptionTierName = computed(() => {
    const tier = subscriptionTier.value
    if (!tier) return ''
    const key = toTierKey(tier) ?? 'standard'
    const baseName = t(`subscription.tiers.${key}.name`)
    return isYearlySubscription.value
      ? t('subscription.tierNameYearly', { name: baseName })
      : baseName
  })

  function buildApiUrl(path: string): string {
    return `${getComfyApiBaseUrl()}${path}`
  }

  const getCheckoutAttributionForCloud =
    async (): Promise<CheckoutAttributionMetadata> => {
      if (__DISTRIBUTION__ !== 'cloud') {
        return {}
      }

      const { getCheckoutAttribution } =
        await import('@/platform/telemetry/utils/checkoutAttribution')

      return getCheckoutAttribution()
    }

  let pendingCheckoutRecoveryTimeout: number | null = null
  let pendingCheckoutRecoveryAttempt = 0
  let isRecoveringPendingCheckout = false
  let activePendingCheckoutRecovery: Promise<BillingStatusResponse | null> | null =
    null
  let pendingCheckoutDeadlineRetryCount = 0
  let lastPendingCheckoutStatus: BillingStatusResponse | null = null
  let isDisposed = false

  const stopPendingCheckoutRecovery = () => {
    if (pendingCheckoutRecoveryTimeout !== null && defaultWindow) {
      defaultWindow.clearTimeout(pendingCheckoutRecoveryTimeout)
    }

    pendingCheckoutRecoveryTimeout = null
    pendingCheckoutRecoveryAttempt = 0
    pendingCheckoutDeadlineRetryCount = 0
  }

  onScopeDispose(() => {
    isDisposed = true
    stopPendingCheckoutRecovery()
  })

  /**
   * The retry ladder is exhausted by the time the deadline matters, so without
   * this the report would wait on the next `pageshow`/`visibilitychange` and
   * never fire for a user who simply leaves the tab open.
   */
  const armMissingCheckoutCompletionWakeUp = (remainingMs: number) => {
    if (
      isDisposed ||
      !defaultWindow ||
      pendingCheckoutRecoveryTimeout !== null
    ) {
      return
    }

    pendingCheckoutRecoveryTimeout = defaultWindow.setTimeout(
      () => {
        pendingCheckoutRecoveryTimeout = null
        void recoverPendingSubscriptionCheckout('deadline')
      },
      Math.min(Math.max(remainingMs, 0), MAX_TIMER_DELAY_MS)
    )
  }

  const getReportableMissingCheckout = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt || hasReportedMissingCheckoutCompletion(attempt.attempt_id)) {
      return null
    }

    const attemptAgeMs = Date.now() - attempt.started_at_ms
    if (attemptAgeMs < PENDING_CHECKOUT_COMPLETION_DEADLINE_MS) {
      armMissingCheckoutCompletionWakeUp(
        PENDING_CHECKOUT_COMPLETION_DEADLINE_MS - attemptAgeMs
      )
      return null
    }

    // Any authoritative snapshot that did not consume the attempt proves its
    // target tier and cycle were not observed, including plan-change checkouts
    // whose previous subscription remains active.
    if (lastPendingCheckoutStatus === null) return null

    return { attempt, attemptAgeMs }
  }

  const reportMissingCheckoutCompletion = (): boolean => {
    const reportable = getReportableMissingCheckout()
    if (!reportable) return false
    const { attempt, attemptAgeMs } = reportable

    // Claimed before emitting, not after: a second tab wakes on the same
    // deadline (both derive it from `started_at_ms`), so a mark that trailed
    // the two emissions left a window wide enough for it to emit as well.
    // localStorage offers no compare-and-swap and propagates writes to other
    // tabs asynchronously, so this narrows that window rather than closing it —
    // `checkout_attempt_id` on both terminals is what makes the duplicate
    // collapsible downstream.
    markMissingCheckoutCompletionReported(attempt.attempt_id)

    reportTelemetryError(
      new Error('Pending subscription checkout recovery timed out'),
      {
        errorType: 'cloud_checkout_completion_missing',
        context: {
          checkout_attempt_id: attempt.attempt_id,
          checkout_type: attempt.checkout_type,
          attempt_age_ms: attemptAgeMs,
          tier: attempt.tier,
          cycle: attempt.cycle,
          ...(attempt.operation
            ? { checkout_operation: attempt.operation }
            : {})
        },
        level: 'warning'
      }
    )
    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'timeout',
      outcome: 'failure',
      checkout_attempt_id: attempt.attempt_id,
      failure_category: 'poll_timeout',
      tier: attempt.tier,
      cycle: attempt.cycle,
      checkout_type: attempt.checkout_type,
      duration_ms: attemptAgeMs
    })
    if (attempt.operation === 'resubscribe') {
      telemetry?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: attempt.resubscribe_source ?? 'settings_billing_panel',
        checkout_attempt_id: attempt.attempt_id,
        failure_category: 'poll_timeout',
        ...(attempt.payment_intent_source
          ? { payment_intent_source: attempt.payment_intent_source }
          : {})
      })
    }
    return true
  }

  const canSchedulePendingCheckoutRecovery = (
    attempt: ReturnType<typeof getPendingSubscriptionCheckoutAttempt>
  ) =>
    !(
      isDisposed ||
      !defaultWindow ||
      pendingCheckoutRecoveryTimeout !== null ||
      !isLoggedIn.value ||
      !attempt
    )

  const schedulePendingCheckoutRecovery = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (
      !canSchedulePendingCheckoutRecovery(attempt) ||
      !attempt ||
      !defaultWindow
    )
      return

    const nextDelay = getPendingCheckoutRetryDelay(
      pendingCheckoutRecoveryAttempt
    )

    if (nextDelay === undefined) {
      const isPastDeadline =
        Date.now() - attempt.started_at_ms >=
        PENDING_CHECKOUT_COMPLETION_DEADLINE_MS
      if (!reportMissingCheckoutCompletion() && isPastDeadline) {
        rearmBoundedDeadlineWakeUp()
      }
      return
    }

    pendingCheckoutRecoveryTimeout = defaultWindow.setTimeout(() => {
      pendingCheckoutRecoveryTimeout = null
      pendingCheckoutRecoveryAttempt += 1
      void recoverPendingSubscriptionCheckout('retry')
    }, nextDelay)
  }

  const getPendingAttemptOwnership = (): CheckoutScopeOwnership => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt) return 'matched'
    const owner = compareCheckoutScopeStamp(attempt.owner_id, authStore.userId)
    const workspace = compareCheckoutScopeStamp(
      attempt.workspace_id,
      workspaceStore.activeWorkspaceId
    )
    if (owner === 'mismatched' || workspace === 'mismatched')
      return 'mismatched'
    if (owner === 'unresolved' || workspace === 'unresolved')
      return 'unresolved'
    return 'matched'
  }

  const trackLateSubscriptionSuccess = (
    metadata: SubscriptionSuccessMetadata
  ) => {
    if (metadata.recovery_outcome !== 'late_success') return
    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'succeeded',
      outcome: 'success',
      checkout_attempt_id: metadata.checkout_attempt_id,
      tier: metadata.tier,
      cycle: metadata.cycle,
      checkout_type: metadata.checkout_type,
      recovery_outcome: 'late_success'
    })
  }

  const trackResubscribeSuccess = (metadata: SubscriptionSuccessMetadata) => {
    if (metadata.operation !== 'resubscribe') return
    telemetry?.trackBillingEvent({
      operation: 'resubscribe',
      stage: 'succeeded',
      outcome: 'success',
      source: metadata.resubscribe_source ?? 'settings_billing_panel',
      checkout_attempt_id: metadata.checkout_attempt_id,
      payment_intent_source: metadata.payment_intent_source,
      recovery_outcome: metadata.recovery_outcome
    })
  }

  const syncPendingSubscriptionSuccess = (
    statusData: BillingStatusResponse
  ) => {
    const ownership = getPendingAttemptOwnership()
    if (ownership === 'mismatched') {
      stopPendingCheckoutRecovery()
      return
    }
    if (ownership === 'unresolved') return
    const metadata = consumePendingSubscriptionCheckoutSuccess(statusData)

    if (!metadata) {
      if (hasPendingSubscriptionCheckoutAttempt()) {
        schedulePendingCheckoutRecovery()
      } else {
        stopPendingCheckoutRecovery()
      }
      return
    }

    telemetry?.trackMonthlySubscriptionSucceeded({
      ...(authStore.userId ? { user_id: authStore.userId } : {}),
      ...metadata
    })

    trackLateSubscriptionSuccess(metadata)

    // The recovery flow is shared with plain (non-resubscribe) legacy subscribes,
    // which all funnel through the same subscribeDirect(). Only emit the canonical
    // resubscribe terminal when the attempt that just resolved was itself tagged
    // as a resubscribe at click time — otherwise a plain new subscribe would be
    // mislabeled as a resubscribe success. Without this, the legacy rail's
    // `billing.resubscribe.started` (emitted at checkout-tab-open) never gets a
    // matching terminal, so resubscribe conversion permanently reads ~0%.
    trackResubscribeSuccess(metadata)

    stopPendingCheckoutRecovery()
  }

  const buildAuthHeaders = async (): Promise<Record<string, string>> => {
    const authHeader =
      (await webSessionResourceHeader()) ?? (await getFirebaseAuthHeader())
    if (!authHeader) {
      throw new AuthStoreError(t('toastMessages.userNotAuthenticated'))
    }

    return {
      ...authHeader,
      'Content-Type': 'application/json'
    }
  }

  const fetchStatus = wrapWithErrorHandlingAsync(
    fetchSubscriptionStatus,
    reportError
  )

  interface SubscribeDirectOptions {
    /** Set when this call originates from the resubscribe flow, not a plain subscribe. */
    operation?: 'resubscribe'
    /** Click-time source for a resubscribe attempt; carried through to the terminal event. */
    source?: ResubscribeClickMetadata['source']
  }

  const getPreviousCycle = (): BillingCycle | undefined => {
    if (subscriptionDuration.value === 'ANNUAL') return 'yearly'
    if (subscriptionDuration.value === 'MONTHLY') return 'monthly'
  }

  const recordStandardCheckoutAttempt = (
    options: SubscribeDirectOptions | undefined,
    scope: {
      ownerId: string | undefined
      workspaceId: string | null
      previousCancelAt: string | null | undefined
    }
  ) => {
    const previousTier = subscriptionTier.value
      ? toTierKey(subscriptionTier.value)
      : null
    const previousCycle = getPreviousCycle()

    const resubscribeDetails =
      options?.operation === 'resubscribe'
        ? {
            operation: options.operation,
            resubscribe_source: options.source,
            ...(scope.previousCancelAt !== undefined
              ? { previous_cancel_at: scope.previousCancelAt }
              : {})
          }
        : {}

    recordPendingSubscriptionCheckoutAttempt({
      tier: 'standard',
      cycle: 'monthly',
      checkout_type: canAccessSubscriptionFeatures.value ? 'change' : 'new',
      previous_tier: previousTier ?? undefined,
      previous_cycle: previousCycle,
      ...resubscribeDetails,
      owner_id: scope.ownerId,
      workspace_id: scope.workspaceId
    })
  }

  /** Unwrapped `subscribe`, for callers that need rejections to propagate (e.g. telemetry). */
  const subscribeDirect = async (
    options?: SubscribeDirectOptions
  ): Promise<void> => {
    const checkoutScope = {
      ownerId: authStore.userId ?? undefined,
      workspaceId: workspaceStore.activeWorkspaceId,
      previousCancelAt: subscriptionStatus.value
        ? (subscriptionStatus.value.cancel_at ?? null)
        : undefined
    }
    const response = await initiateSubscriptionCheckout()

    if (!response.checkout_url) {
      throw new Error(
        t('toastMessages.failedToInitiateSubscription', {
          error: 'No checkout URL returned'
        })
      )
    }

    const checkoutWindow = window.open(response.checkout_url, '_blank')
    if (!checkoutWindow) {
      return
    }

    recordStandardCheckoutAttempt(options, checkoutScope)
  }

  const subscribe = wrapWithErrorHandlingAsync(subscribeDirect, reportError)

  const showSubscriptionDialog = (options?: SubscriptionDialogOptions) => {
    void showSubscriptionRequiredDialog(options)
  }

  /**
   * Whether cloud subscription mode is enabled (cloud distribution with subscription_required config).
   */
  const isSubscriptionEnabled = (): boolean =>
    Boolean(isCloud && window.__CONFIG__?.subscription_required)

  const { startCancellationWatcher, stopCancellationWatcher } =
    useSubscriptionCancellationWatcher({
      fetchStatus,
      canAccessSubscriptionFeatures: canAccessSubscriptionFeatures,
      subscriptionStatus,
      telemetry,
      shouldWatchCancellation: isSubscriptionEnabled
    })

  const manageSubscription = async () => {
    const didOpenPortal = await accessBillingPortal()
    if (!didOpenPortal) {
      return
    }

    startCancellationWatcher()
  }

  const requireActiveSubscription = async (): Promise<void> => {
    await fetchSubscriptionStatus()

    if (!canAccessSubscriptionFeatures.value) {
      showSubscriptionDialog({ reason: 'subscription_required' })
    }
  }

  const handleViewUsageHistory = () => {
    window.open(platformLink('/profile/usage'), '_blank')
  }

  const handleLearnMore = () => {
    window.open('https://docs.comfy.org', '_blank')
  }

  const handleInvoiceHistory = async () => {
    await accessBillingPortal()
  }

  type PendingCheckoutRecoverySource =
    | 'bootstrap'
    | 'pageshow'
    | 'visibilitychange'
    | 'retry'
    | 'deadline'

  const canRecoverPendingCheckout = () =>
    isCloud && isLoggedIn.value && hasOwnedPendingCheckoutAttempt()

  const hasOwnedPendingCheckoutAttempt = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt) return false
    return getPendingAttemptOwnership() === 'matched'
  }

  const handlePendingCheckoutRecoveryError = (
    source: PendingCheckoutRecoverySource,
    error: unknown
  ) => {
    console.error(
      `[Subscription] Failed to recover pending checkout on ${source}:`,
      error
    )
    const attempt = getPendingSubscriptionCheckoutAttempt()
    const isPastDeadline =
      attempt !== null &&
      Date.now() - attempt.started_at_ms >=
        PENDING_CHECKOUT_COMPLETION_DEADLINE_MS
    if (source === 'deadline' || isPastDeadline) {
      reportRecoveryUnreachable(error)
      rearmBoundedDeadlineWakeUp()
    } else {
      schedulePendingCheckoutRecovery()
    }
  }

  const reportRecoveryUnreachable = (error?: unknown) => {
    if (isDisposed) return
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (
      !attempt ||
      hasReportedRecoveryUnreachable(attempt.attempt_id) ||
      hasReportedMissingCheckoutCompletion(attempt.attempt_id)
    ) {
      return
    }

    markRecoveryUnreachableReported(attempt.attempt_id)
    reportTelemetryError(
      new Error(
        'Pending subscription checkout recovery could not reach billing'
      ),
      {
        errorType: 'cloud_checkout_recovery_unreachable',
        context: {
          checkout_attempt_id: attempt.attempt_id,
          checkout_type: attempt.checkout_type,
          attempt_age_ms: Date.now() - attempt.started_at_ms,
          tier: attempt.tier,
          cycle: attempt.cycle
        },
        level: 'warning'
      }
    )
    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      checkout_attempt_id: attempt.attempt_id,
      failure_category: categorizeBillingApiError(error),
      tier: attempt.tier,
      cycle: attempt.cycle,
      checkout_type: attempt.checkout_type,
      duration_ms: Date.now() - attempt.started_at_ms
    })
    if (attempt.operation === 'resubscribe') {
      telemetry?.trackBillingEvent({
        operation: 'resubscribe',
        stage: 'failed',
        outcome: 'failure',
        source: attempt.resubscribe_source ?? 'settings_billing_panel',
        checkout_attempt_id: attempt.attempt_id,
        failure_category: categorizeBillingApiError(error)
      })
    }
  }

  const waitForActiveRecoveryAtDeadline = async (
    source: PendingCheckoutRecoverySource
  ): Promise<boolean> => {
    if (!isRecoveringPendingCheckout) return false
    if (source !== 'deadline' || !activePendingCheckoutRecovery) return true

    try {
      const status = await withTimeout(
        activePendingCheckoutRecovery,
        PENDING_CHECKOUT_DEADLINE_REFRESH_TIMEOUT_MS
      )
      return status !== null
    } catch (error) {
      console.error(
        '[Subscription] Pending checkout recovery was still running at the deadline:',
        error
      )
      reportRecoveryUnreachable(error)
      rearmBoundedDeadlineWakeUp()
      return false
    }
  }

  const fetchPendingCheckoutStatus = async () => {
    lastPendingCheckoutStatus = null
    const statusFetch = fetchSubscriptionStatus()
    activePendingCheckoutRecovery = statusFetch
    try {
      return await withTimeout(
        statusFetch,
        PENDING_CHECKOUT_DEADLINE_REFRESH_TIMEOUT_MS
      )
    } catch (error) {
      clearInFlightStatusFetch(statusFetch)
      throw error
    }
  }

  const rearmBoundedDeadlineWakeUp = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt) return
    if (
      pendingCheckoutDeadlineRetryCount >=
      PENDING_CHECKOUT_DEADLINE_RETRY_DELAYS_MS.length
    )
      return
    const delay =
      PENDING_CHECKOUT_DEADLINE_RETRY_DELAYS_MS[
        pendingCheckoutDeadlineRetryCount
      ]
    pendingCheckoutDeadlineRetryCount += 1
    armMissingCheckoutCompletionWakeUp(delay)
  }

  const retryUnavailableDeadline = (source: PendingCheckoutRecoverySource) => {
    if (source !== 'deadline') return

    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (attempt) rearmBoundedDeadlineWakeUp()
  }

  const handleEmptyPendingCheckoutStatus = (
    source: PendingCheckoutRecoverySource
  ) => {
    if (source === 'deadline') {
      rearmBoundedDeadlineWakeUp()
    } else {
      schedulePendingCheckoutRecovery()
    }
  }

  const recoverPendingSubscriptionCheckout = async (
    source: PendingCheckoutRecoverySource
  ) => {
    if (!canRecoverPendingCheckout()) {
      retryUnavailableDeadline(source)
      return
    }
    if (isRecoveringPendingCheckout) {
      const didObserveStatus = await waitForActiveRecoveryAtDeadline(source)
      if (!isDisposed && source === 'deadline') {
        if (didObserveStatus) reportMissingCheckoutCompletion()
        else retryUnavailableDeadline(source)
      }
      return
    }

    if (!(await runPendingCheckoutRecovery(source))) return

    if (source === 'deadline') reportMissingCheckoutCompletion()
  }

  const runPendingCheckoutRecovery = async (
    source: PendingCheckoutRecoverySource
  ): Promise<boolean> => {
    isRecoveringPendingCheckout = true
    try {
      const status = await fetchPendingCheckoutStatus()
      if (isDisposed) return false
      if (status === null) {
        handleEmptyPendingCheckoutStatus(source)
        return false
      }
      return true
    } catch (error) {
      handlePendingCheckoutRecoveryError(source, error)
      return false
    } finally {
      isRecoveringPendingCheckout = false
      activePendingCheckoutRecovery = null
    }
  }

  // Coalesce concurrent callers so an auth/session-rotation burst mints one fetch.
  let inFlightStatusFetch: Promise<BillingStatusResponse | null> | null = null
  let inFlightStatusOwnerId: string | null = null
  let inFlightStatusWorkspaceId: string | null = null
  let nextStatusFetchSequence = 0
  let statusScopeGeneration = 0
  let observedStatusScope = `${authStore.userId ?? ''}\0${workspaceStore.activeWorkspaceId ?? ''}`

  const observeStatusScope = (
    ownerId: string | null,
    workspaceId: string | null
  ) => {
    const scope = `${ownerId ?? ''}\0${workspaceId ?? ''}`
    if (scope === observedStatusScope) return
    observedStatusScope = scope
    statusScopeGeneration += 1
  }

  watch(
    () => [authStore.userId, workspaceStore.activeWorkspaceId] as const,
    ([ownerId, workspaceId]) => {
      observeStatusScope(ownerId ?? null, workspaceId)
      if (
        workspaceId &&
        hasPendingSubscriptionCheckoutAttempt() &&
        getPendingAttemptOwnership() === 'matched'
      ) {
        void recoverPendingSubscriptionCheckout('retry')
      }
    }
  )

  const clearInFlightStatusFetch = (
    fetchPromise: Promise<BillingStatusResponse | null>
  ) => {
    if (inFlightStatusFetch !== fetchPromise) return

    inFlightStatusFetch = null
    inFlightStatusOwnerId = null
    inFlightStatusWorkspaceId = null
  }

  function fetchSubscriptionStatus(): Promise<BillingStatusResponse | null> {
    const ownerId = authStore.userId ?? null
    const workspaceId = workspaceStore.activeWorkspaceId
    observeStatusScope(ownerId, workspaceId)
    if (
      inFlightStatusFetch &&
      inFlightStatusOwnerId === ownerId &&
      inFlightStatusWorkspaceId === workspaceId
    ) {
      return inFlightStatusFetch
    }

    const sequence = ++nextStatusFetchSequence
    const scopeGeneration = statusScopeGeneration
    const fetchPromise = performFetchSubscriptionStatus(
      ownerId,
      workspaceId,
      sequence,
      scopeGeneration
    )
    inFlightStatusFetch = fetchPromise
    inFlightStatusOwnerId = ownerId
    inFlightStatusWorkspaceId = workspaceId
    void fetchPromise
      .catch(() => undefined)
      .finally(() => {
        clearInFlightStatusFetch(fetchPromise)
      })
    return fetchPromise
  }

  /**
   * The status read on whichever rail is on, in the failure shape the legacy
   * client threw in. The rail is taken before the read and held for it: a flag
   * flip mid-read must not start on one client and publish through the other.
   */
  async function readSubscriptionStatus(): Promise<
    BillingStatusResponse | undefined
  > {
    const rail = useBillingReadRail()
    try {
      const status = rail
        ? await readOnRail(rail.readStatus)
        : await workspaceApi.getBillingStatus()
      return status
    } catch (error) {
      const status =
        error instanceof WorkspaceApiError || error instanceof AuthStoreError
          ? error.status
          : undefined
      throw new AuthStoreError(
        t('toastMessages.failedToFetchSubscription', {
          error: error instanceof Error ? error.message : String(error)
        }),
        status
      )
    }
  }

  async function performFetchSubscriptionStatus(
    ownerId: string | null,
    workspaceId: string | null,
    sequence: number,
    scopeGeneration: number
  ): Promise<BillingStatusResponse | null> {
    if (!isCloud) return null

    const statusData = await readSubscriptionStatus()
    if (
      !isPublishableStatusRead(
        statusData,
        ownerId,
        workspaceId,
        sequence,
        scopeGeneration
      )
    )
      return null
    publishSubscriptionStatus(statusData, workspaceId)

    return statusData
  }

  function isPublishableStatusRead(
    statusData: BillingStatusResponse | undefined,
    ownerId: string | null,
    workspaceId: string | null,
    sequence: number,
    scopeGeneration: number
  ): statusData is BillingStatusResponse {
    return (
      !isDisposed &&
      statusData !== undefined &&
      scopeGeneration === statusScopeGeneration &&
      sequence === nextStatusFetchSequence &&
      (authStore.userId ?? null) === ownerId &&
      workspaceStore.activeWorkspaceId === workspaceId
    )
  }

  function publishSubscriptionStatus(
    statusData: BillingStatusResponse,
    workspaceId: string | null
  ): void {
    // Only a current, publishable read proves billing is reachable.
    lastPendingCheckoutStatus = statusData
    subscriptionStatus.value = statusData
    if (workspaceId && statusData.billing_rail) {
      workspaceStore.setWorkspaceBillingRail(
        workspaceId,
        statusData.billing_rail
      )
    }
    syncPendingSubscriptionSuccess(statusData)
  }

  const handlePendingSubscriptionCheckoutChange = () => {
    if (!hasPendingSubscriptionCheckoutAttempt()) {
      stopPendingCheckoutRecovery()
      return
    }

    stopPendingCheckoutRecovery()
    void recoverPendingSubscriptionCheckout('retry')
  }

  useEventListener(defaultWindow, PENDING_SUBSCRIPTION_CHECKOUT_EVENT, () => {
    handlePendingSubscriptionCheckoutChange()
  })

  useEventListener(defaultWindow, 'storage', (event: StorageEvent) => {
    if (event.key === PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) {
      handlePendingSubscriptionCheckoutChange()
    }
  })

  useEventListener(defaultWindow, 'pageshow', () => {
    void recoverPendingSubscriptionCheckout('pageshow')
  })

  useEventListener(defaultDocument, 'visibilitychange', () => {
    if (defaultDocument?.visibilityState === 'visible') {
      void recoverPendingSubscriptionCheckout('visibilitychange')
    }
  })

  watch(
    () =>
      [authStore.isInitialized, isLoggedIn.value, authStore.userId] as const,
    async ([authInitialized, loggedIn]) => {
      if (!authInitialized) {
        return
      }

      if (loggedIn && isCloud) {
        try {
          if (hasOwnedPendingCheckoutAttempt()) {
            await recoverPendingSubscriptionCheckout('bootstrap')
          } else {
            await fetchSubscriptionStatus()
          }
        } catch (error) {
          // Network errors are expected during navigation/component unmount
          // and when offline - log for debugging but don't surface to user
          console.error('Failed to fetch subscription status:', error)
        } finally {
          isInitialized.value = true
        }
      } else {
        subscriptionStatus.value = null
        clearPendingSubscriptionCheckoutAttempt()
        stopPendingCheckoutRecovery()
        stopCancellationWatcher()
        isInitialized.value = true
      }
    },
    { immediate: true }
  )

  const initiateSubscriptionCheckout =
    async (): Promise<CloudSubscriptionCheckoutResponse> => {
      const headers = await buildAuthHeaders()
      const checkoutAttribution = await getCheckoutAttributionForCloud()

      const response = await fetchWithCustomerRecovery(
        buildApiUrl('/customers/cloud-subscription-checkout'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(checkoutAttribution)
        }
      )

      if (!response.ok) {
        const { message } = await parseErrorResponse(response)
        throw new AuthStoreError(
          t('toastMessages.failedToInitiateSubscription', {
            error: message
          }),
          response.status
        )
      }

      return response.json()
    }

  return {
    // State
    canAccessSubscriptionFeatures: canAccessSubscriptionFeatures,
    isInitialized,
    isCancelled,
    formattedRenewalDate,
    formattedEndDate,
    subscriptionTier,
    isFreeTier,
    subscriptionDuration,
    isYearlySubscription,
    subscriptionTierName,
    subscriptionStatus,

    // Utilities
    isSubscriptionEnabled,

    // Actions
    subscribe,
    subscribeDirect,
    fetchStatus,
    showSubscriptionDialog,
    manageSubscription,
    requireActiveSubscription,
    handleViewUsageHistory,
    handleLearnMore,
    handleInvoiceHistory
  }
}

function getPendingCheckoutRetryDelay(attempt: number): number | undefined {
  return PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS[attempt]
}

export const useSubscription = createSharedComposable(useSubscriptionInternal)
