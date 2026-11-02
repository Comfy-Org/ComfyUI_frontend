import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
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
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError as reportTelemetryError } from '@comfyorg/telemetry/reportError'
import type { SubscriptionSuccessMetadata } from '@comfyorg/telemetry/types'
import type { BillingStatusResponse } from '@comfyorg/billing-core'
import { billingApi } from '@/platform/billing/api/billingApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { readOnRail } from '@/platform/billing/composables/readOnRail'
import { useBillingReadRail } from '@/platform/billing/composables/useBillingReadRail'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { platformLink } from '@/platform/workspace/utils/platformLink'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { toTierKey } from '@/platform/billing/subscription/constants/tierPricing'
import {
  PENDING_SUBSCRIPTION_CHECKOUT_EVENT,
  PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
  clearPendingSubscriptionCheckoutAttempt,
  consumePendingSubscriptionCheckoutSuccess,
  getPendingSubscriptionCheckoutAttempt,
  claimPendingCheckoutTerminal,
  getPendingCheckoutTerminal,
  hasPendingSubscriptionCheckoutAttempt
} from '@/platform/billing/subscription/utils/subscriptionCheckoutTracker'
import type { BillingStatusReadOptions } from '@/platform/billing/composables/types'

const PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS = [3000, 10000, 30000]

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
  const { reportError } = useAuthActions()

  const authStore = useAuthStore()
  const workspaceStore = useWorkspaceIdentity()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const { isLoggedIn } = useCurrentUser()

  // Web-session billing reads need the workspace the gate selects after sign-in.
  const awaitingSessionWorkspace = computed(
    () => !!authStore.sessionUser && !workspaceStore.activeWorkspaceId
  )

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
    // TEAM and ENTERPRISE map to no catalog key (see toTierKey); reuse their
    // existing copy instead of mislabeling them as Standard.
    if (tier === 'TEAM') return t('subscription.teamPlanName')
    if (tier === 'ENTERPRISE') return t('subscription.tiers.enterprise.name')
    const key = toTierKey(tier)
    const baseName = key
      ? t(`subscription.tiers.${key}.name`)
      : t('subscription.unknownTierName')
    return isYearlySubscription.value
      ? t('subscription.tierNameYearly', { name: baseName })
      : baseName
  })

  interface PendingCheckoutSchedule {
    timeoutId: number | null
    retryRung: number
    deadlineRung: number
  }

  const IDLE_PENDING_CHECKOUT_SCHEDULE: PendingCheckoutSchedule = {
    timeoutId: null,
    retryRung: 0,
    deadlineRung: 0
  }

  let pendingCheckoutSchedule = IDLE_PENDING_CHECKOUT_SCHEDULE
  let activePendingCheckoutRead: {
    attemptId: string
    promise: Promise<BillingStatusResponse | null>
  } | null = null
  let lastPendingCheckoutStatus: BillingStatusResponse | null = null
  let isDisposed = false

  const stopPendingCheckoutRecovery = () => {
    if (pendingCheckoutSchedule.timeoutId !== null && defaultWindow) {
      defaultWindow.clearTimeout(pendingCheckoutSchedule.timeoutId)
    }
    pendingCheckoutSchedule = IDLE_PENDING_CHECKOUT_SCHEDULE
  }

  const armPendingCheckoutTimer = (delayMs: number, onFire: () => void) => {
    if (!defaultWindow) return
    const timeoutId = defaultWindow.setTimeout(() => {
      pendingCheckoutSchedule = { ...pendingCheckoutSchedule, timeoutId: null }
      onFire()
    }, delayMs)
    pendingCheckoutSchedule = { ...pendingCheckoutSchedule, timeoutId }
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
    if (isDisposed || pendingCheckoutSchedule.timeoutId !== null) return

    armPendingCheckoutTimer(Math.max(remainingMs, 0), () => {
      void recoverPendingSubscriptionCheckout('deadline')
    })
  }

  const getCurrentPendingCheckoutAttempt = (attemptId: string) => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    return attempt?.attempt_id === attemptId ? attempt : null
  }

  const getReportableMissingCheckout = (attemptId: string) => {
    const attempt = getCurrentPendingCheckoutAttempt(attemptId)
    if (!attempt || getPendingCheckoutTerminal(attempt.attempt_id)) {
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

  const reportMissingCheckoutCompletion = (attemptId: string): boolean => {
    const reportable = getReportableMissingCheckout(attemptId)
    if (!reportable) return false
    const { attemptAgeMs } = reportable
    const attempt = claimPendingCheckoutTerminal(
      attemptId,
      'completion_missing'
    )
    if (!attempt) return false

    reportTelemetryError(
      new Error('Pending subscription checkout recovery timed out'),
      {
        errorType: 'failure_completing_cloud_checkout',
        surface: 'billing',
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
      pendingCheckoutSchedule.timeoutId !== null ||
      !isLoggedIn.value ||
      !attempt
    )

  const schedulePendingCheckoutRecovery = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!canSchedulePendingCheckoutRecovery(attempt) || !attempt) return

    const nextDelay = getPendingCheckoutRetryDelay(
      pendingCheckoutSchedule.retryRung
    )

    if (nextDelay === undefined) {
      const isPastDeadline =
        Date.now() - attempt.started_at_ms >=
        PENDING_CHECKOUT_COMPLETION_DEADLINE_MS
      if (
        !reportMissingCheckoutCompletion(attempt.attempt_id) &&
        isPastDeadline
      ) {
        rearmBoundedDeadlineWakeUp()
      }
      return
    }

    armPendingCheckoutTimer(nextDelay, () => {
      pendingCheckoutSchedule = {
        ...pendingCheckoutSchedule,
        retryRung: pendingCheckoutSchedule.retryRung + 1
      }
      void recoverPendingSubscriptionCheckout('retry')
    })
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

  const trackSubscriptionCheckoutSuccess = (
    metadata: SubscriptionSuccessMetadata,
    startReported: boolean,
    startedAtMs: number
  ) => {
    if (!startReported && metadata.recovery_outcome !== 'late_success') return
    telemetry?.trackBillingEvent({
      operation: 'subscription_checkout',
      stage: 'succeeded',
      outcome: 'success',
      checkout_attempt_id: metadata.checkout_attempt_id,
      tier: metadata.tier,
      cycle: metadata.cycle,
      checkout_type: metadata.checkout_type,
      payment_intent_source: metadata.payment_intent_source,
      recovery_outcome: metadata.recovery_outcome,
      duration_ms: Date.now() - startedAtMs
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
    const consumed = consumePendingSubscriptionCheckoutSuccess(statusData)

    if (!consumed) {
      if (hasPendingSubscriptionCheckoutAttempt()) {
        schedulePendingCheckoutRecovery()
      } else {
        stopPendingCheckoutRecovery()
      }
      return
    }

    const {
      start_reported: startReported,
      started_at_ms: startedAtMs,
      ...metadata
    } = consumed

    telemetry?.trackMonthlySubscriptionSucceeded({
      ...(authStore.userId ? { user_id: authStore.userId } : {}),
      ...metadata
    })

    trackSubscriptionCheckoutSuccess(
      metadata,
      startReported === true,
      startedAtMs
    )

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

  const fetchStatus = wrapWithErrorHandlingAsync(
    fetchSubscriptionStatus,
    reportError
  )

  /**
   * Whether cloud subscription mode is enabled (cloud distribution with subscription_required config).
   */
  const isSubscriptionEnabled = (): boolean =>
    Boolean(isCloud && window.__CONFIG__?.subscription_required)

  const handleViewUsageHistory = () => {
    window.open(platformLink('/profile/usage'), '_blank')
  }

  const handleLearnMore = () => {
    window.open('https://docs.comfy.org', '_blank')
  }

  type PendingCheckoutRecoverySource =
    | 'bootstrap'
    | 'pageshow'
    | 'visibilitychange'
    | 'retry'
    | 'deadline'

  const canRecoverPendingCheckout = () =>
    isCloud &&
    isLoggedIn.value &&
    !awaitingSessionWorkspace.value &&
    hasOwnedPendingCheckoutAttempt()

  const hasOwnedPendingCheckoutAttempt = () => {
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt) return false
    return getPendingAttemptOwnership() === 'matched'
  }

  const handlePendingCheckoutRecoveryError = (
    source: PendingCheckoutRecoverySource,
    attemptId: string,
    error: unknown
  ) => {
    console.error(
      `[Subscription] Failed to recover pending checkout on ${source}:`,
      error
    )
    const attempt = getCurrentPendingCheckoutAttempt(attemptId)
    if (!attempt) return
    const isPastDeadline =
      Date.now() - attempt.started_at_ms >=
      PENDING_CHECKOUT_COMPLETION_DEADLINE_MS
    if (source === 'deadline' || isPastDeadline) {
      reportRecoveryUnreachable(attemptId, error)
      rearmBoundedDeadlineWakeUp()
    } else {
      schedulePendingCheckoutRecovery()
    }
  }

  const reportRecoveryUnreachable = (attemptId: string, error?: unknown) => {
    if (isDisposed) return
    const attempt = claimPendingCheckoutTerminal(
      attemptId,
      'recovery_unreachable'
    )
    if (!attempt) return
    reportTelemetryError(
      new Error(
        'Pending subscription checkout recovery could not reach billing'
      ),
      {
        errorType: 'failure_recovering_cloud_checkout',
        surface: 'billing',
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
    source: PendingCheckoutRecoverySource,
    attemptId: string
  ): Promise<boolean> => {
    if (activePendingCheckoutRead?.attemptId !== attemptId) return false
    if (source !== 'deadline') return true

    try {
      const status = await withTimeout(
        activePendingCheckoutRead.promise,
        PENDING_CHECKOUT_DEADLINE_REFRESH_TIMEOUT_MS
      )
      return status !== null
    } catch (error) {
      console.error(
        '[Subscription] Pending checkout recovery was still running at the deadline:',
        error
      )
      reportRecoveryUnreachable(attemptId, error)
      rearmBoundedDeadlineWakeUp()
      return false
    }
  }

  const fetchPendingCheckoutStatus = async (attemptId: string) => {
    lastPendingCheckoutStatus = null
    const statusFetch = fetchSubscriptionStatus()
    activePendingCheckoutRead = { attemptId, promise: statusFetch }
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
    const { deadlineRung } = pendingCheckoutSchedule
    if (deadlineRung >= PENDING_CHECKOUT_DEADLINE_RETRY_DELAYS_MS.length) return
    const delay = PENDING_CHECKOUT_DEADLINE_RETRY_DELAYS_MS[deadlineRung]
    pendingCheckoutSchedule = {
      ...pendingCheckoutSchedule,
      deadlineRung: deadlineRung + 1
    }
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
    const attempt = getPendingSubscriptionCheckoutAttempt()
    if (!attempt) return
    const attemptId = attempt.attempt_id
    if (activePendingCheckoutRead?.attemptId === attemptId) {
      await joinActivePendingCheckoutRecovery(source, attemptId)
      return
    }

    if (!(await runPendingCheckoutRecovery(source, attemptId))) return

    if (source === 'deadline') reportMissingCheckoutCompletion(attemptId)
  }

  const joinActivePendingCheckoutRecovery = async (
    source: PendingCheckoutRecoverySource,
    attemptId: string
  ) => {
    const didObserveStatus = await waitForActiveRecoveryAtDeadline(
      source,
      attemptId
    )
    if (isDisposed || source !== 'deadline') return
    if (didObserveStatus) reportMissingCheckoutCompletion(attemptId)
    else retryUnavailableDeadline(source)
  }

  const runPendingCheckoutRecovery = async (
    source: PendingCheckoutRecoverySource,
    attemptId: string
  ): Promise<boolean> => {
    try {
      const status = await fetchPendingCheckoutStatus(attemptId)
      if (isDisposed) return false
      if (status === null) {
        handleEmptyPendingCheckoutStatus(source)
        return false
      }
      return true
    } catch (error) {
      handlePendingCheckoutRecoveryError(source, attemptId, error)
      return false
    } finally {
      if (activePendingCheckoutRead?.attemptId === attemptId) {
        activePendingCheckoutRead = null
      }
    }
  }

  // Coalesce concurrent callers so an auth/session-rotation burst mints one fetch.
  let inFlightStatusRead: {
    promise: Promise<BillingStatusResponse | null>
    ownerId: string | null
    workspaceId: string | null
    pendingAttemptId: string | null
  } | null = null
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
    // The invoice link is a bearer payment URL: never carry it across scopes.
    if (subscriptionStatus.value?.renewal_invoice) {
      subscriptionStatus.value = {
        ...subscriptionStatus.value,
        renewal_invoice: undefined
      }
    }
  }

  watch(
    () =>
      [
        authStore.userId,
        workspaceStore.activeWorkspaceId,
        awaitingSessionWorkspace.value
      ] as const,
    ([ownerId, workspaceId], [, , wasAwaitingWorkspace]) => {
      observeStatusScope(ownerId ?? null, workspaceId)
      // The bootstrap watcher reads for the session's first workspace.
      if (wasAwaitingWorkspace) return
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
    if (inFlightStatusRead?.promise === fetchPromise) inFlightStatusRead = null
  }

  const sharedStatusRead = (
    ownerId: string | null,
    workspaceId: string | null,
    pendingAttemptId: string | null
  ): Promise<BillingStatusResponse | null> | null =>
    inFlightStatusRead?.ownerId === ownerId &&
    inFlightStatusRead.workspaceId === workspaceId &&
    inFlightStatusRead.pendingAttemptId === pendingAttemptId
      ? inFlightStatusRead.promise
      : null

  function fetchSubscriptionStatus(
    options?: BillingStatusReadOptions
  ): Promise<BillingStatusResponse | null> {
    const ownerId = authStore.userId ?? null
    const workspaceId = workspaceStore.activeWorkspaceId
    const pendingAttemptId =
      getPendingSubscriptionCheckoutAttempt()?.attempt_id ?? null
    observeStatusScope(ownerId, workspaceId)
    const shared = sharedStatusRead(ownerId, workspaceId, pendingAttemptId)
    if (shared) {
      if (!options?.fresh) return shared
      return shared
        .catch(() => null)
        .then(() => fetchSubscriptionStatus(options))
    }

    const sequence = ++nextStatusFetchSequence
    const scopeGeneration = statusScopeGeneration
    const fetchPromise = performFetchSubscriptionStatus(
      ownerId,
      workspaceId,
      sequence,
      scopeGeneration
    )
    inFlightStatusRead = {
      promise: fetchPromise,
      ownerId,
      workspaceId,
      pendingAttemptId
    }
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
        ? await readOnRail(rail.readStatus, 'getBillingStatus')
        : await billingApi.getBillingStatus()
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
      useWorkspaceBillingStateStore().setWorkspaceBillingRail(
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
      [
        authStore.isInitialized,
        isLoggedIn.value,
        authStore.userId,
        awaitingSessionWorkspace.value
      ] as const,
    async ([authInitialized, loggedIn, , awaitingWorkspace]) => {
      if (!authInitialized) {
        return
      }

      if (loggedIn && isCloud) {
        if (awaitingWorkspace) return
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
        isInitialized.value = true
      }
    },
    { immediate: true }
  )

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
    fetchStatus,
    fetchStatusDirect: fetchSubscriptionStatus,
    handleViewUsageHistory,
    handleLearnMore
  }
}

function getPendingCheckoutRetryDelay(attempt: number): number | undefined {
  return PENDING_SUBSCRIPTION_CHECKOUT_RETRY_DELAYS_MS[attempt]
}

export const useSubscription = createSharedComposable(useSubscriptionInternal)
