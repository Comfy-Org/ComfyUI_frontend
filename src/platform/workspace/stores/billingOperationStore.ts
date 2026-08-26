import type { ToastMessageOptions } from 'primevue/toast'
import { loadStripe } from '@stripe/stripe-js/pure'
import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type {
  BillingFailure,
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  BillingAuthenticationState,
  BillingDeclineReason
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const INITIAL_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 8000
const ACTION_REQUIRED_INTERVAL_MS = 30_000
const BACKOFF_MULTIPLIER = 1.5
const TIMEOUT_MS = 120_000
const SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS = 5 * 60_000
const AUTHENTICATION_TIMEOUT_MS = 23 * 60 * 60_000
// Failure reason for a checkout the user replaced by picking a different plan
// mid-flow. The operation is terminal-failed only because it never completed —
// its replacement is proceeding normally, so there is nothing to report.
const CHECKOUT_SUPERSEDED_REASON = 'checkout_superseded'

type OperationType = 'subscription' | 'topup' | 'cancel'
type OperationStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'reconciliation_needed'

export interface StartOperationMetadata {
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  suppressProcessingToast?: boolean
  autoHandleRequiresAction?: boolean
  downgradeToPersonal?: {
    memberRemovalCount: number
    memberRemovalFailures: number
    targetTier?: TierKey
    startedAt: number
  }
  /**
   * The timestamp the caller used for its own canonical `started` telemetry
   * event (i.e. before the initiating subscribe/top-up/cancel API call), so
   * `duration_ms` on the poller's terminal events spans the full emitted
   * lifecycle instead of just the poll-observation window. Defaults to
   * `Date.now()` (poll-start time) when the caller has no such timestamp,
   * e.g. recovering a pending operation on page load.
   */
  attemptStartedAt?: number
}

interface BillingOperation {
  opId: string
  type: OperationType
  status: OperationStatus
  errorMessage: string | null
  startedAt: number
  operationStartedAt: number
  businessAttemptStartedAt?: number
  actionUrl: string | null
  authenticationState: BillingAuthenticationState | null
  isAuthenticating: boolean
  canRetryAuthentication: boolean
  authenticationRequiredSeen: boolean
  workspaceId: string | null
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  autoHandleRequiresAction: boolean
  downgradeToPersonal?: StartOperationMetadata['downgradeToPersonal']
}

type TerminalResolver = (operation: BillingOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const workspaceStore = useTeamWorkspaceStore()
  const { flags } = useFeatureFlags()
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
  const receivedToasts = new Map<string, ToastMessageOptions>()
  const terminalResolvers = new Map<string, TerminalResolver>()
  const terminalPromises = new Map<string, Promise<BillingOperation>>()
  const autoHandledPaymentActions = new Set<string>()
  const paymentIntentClientSecrets = new Map<string, string>()
  const inFlightPolls = new Map<string, Promise<void>>()

  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'visible') pollPendingOperations()
  })

  const hasPendingOperations = computed(() =>
    [...operations.value.values()].some((op) => op.status === 'pending')
  )

  const isSettingUp = computed(() =>
    [...operations.value.values()].some(
      (op) =>
        op.status === 'pending' &&
        op.authenticationState !== 'requires_action' &&
        op.authenticationState !== 'failed_retryable' &&
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const isAddingCredits = computed(() =>
    [...operations.value.values()].some(
      (op) =>
        op.status === 'pending' &&
        op.type === 'topup' &&
        op.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const subscriptionActionOperation = computed(() =>
    [...operations.value.values()].find(
      (op) =>
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId &&
        ((op.status === 'pending' &&
          (op.actionUrl !== null ||
            op.authenticationState === 'requires_action' ||
            op.authenticationState === 'failed_retryable')) ||
          op.status === 'reconciliation_needed')
    )
  )

  const topupActionOperation = computed(() =>
    [...operations.value.values()].find(
      (op) =>
        op.type === 'topup' &&
        op.workspaceId === workspaceStore.activeWorkspaceId &&
        ((op.status === 'pending' &&
          (op.actionUrl !== null || op.canRetryAuthentication)) ||
          op.status === 'reconciliation_needed')
    )
  )

  function getOperation(opId: string) {
    return operations.value.get(opId)
  }

  // An operation parked on a bank challenge is waiting on the customer, not on
  // us, so it must not keep announcing "processing" — that reads as "nothing to
  // do here" next to the verification prompt the same state renders.
  function showProgressToast(
    opId: string,
    type: Exclude<OperationType, 'cancel'>,
    actionRequired: boolean
  ) {
    const toastStore = useToastStore()
    const previous = receivedToasts.get(opId)
    if (previous) toastStore.remove(previous)

    const messageKey =
      type === 'subscription'
        ? actionRequired
          ? 'billingOperation.subscriptionActionRequired'
          : 'billingOperation.subscriptionProcessing'
        : actionRequired
          ? 'billingOperation.topupActionRequired'
          : 'billingOperation.topupProcessing'

    const toastMessage: ToastMessageOptions = {
      // 'warn' selects the prompt icon over the spinner in GlobalToast.
      severity: actionRequired ? 'warn' : 'info',
      summary: t(messageKey),
      group: 'billing-operation'
    }
    receivedToasts.set(opId, toastMessage)
    toastStore.add(toastMessage)
  }

  function startOperation(
    opId: string,
    type: OperationType,
    metadata?: StartOperationMetadata,
    initialActionUrl?: string
  ): Promise<BillingOperation> {
    const existing = operations.value.get(opId)
    if (existing && existing.status !== 'timeout') {
      return terminalPromises.get(opId) ?? Promise.resolve(existing)
    }
    if (existing) clearOperation(opId)

    const actionUrl = validateActionUrl(initialActionUrl)
    const now = Date.now()
    const operation: BillingOperation = {
      opId,
      type,
      status: 'pending',
      errorMessage: null,
      startedAt: now,
      operationStartedAt: metadata?.attemptStartedAt ?? now,
      businessAttemptStartedAt: metadata?.attemptStartedAt,
      actionUrl,
      authenticationState: null,
      isAuthenticating: false,
      canRetryAuthentication: false,
      authenticationRequiredSeen: actionUrl !== null,
      workspaceId: workspaceStore.activeWorkspaceId,
      tier: metadata?.tier,
      cycle: metadata?.cycle,
      checkoutType: metadata?.checkoutType,
      paymentIntentSource: metadata?.paymentIntentSource,
      autoHandleRequiresAction: metadata?.autoHandleRequiresAction ?? false,
      downgradeToPersonal: metadata?.downgradeToPersonal
    }

    operations.value = new Map(operations.value).set(opId, operation)
    intervals.set(opId, INITIAL_INTERVAL_MS)

    if (metadata?.attemptStartedAt === undefined) {
      useTelemetry()?.trackBillingEvent({
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: type
      })
    }

    if (type !== 'cancel' && !metadata?.suppressProcessingToast) {
      showProgressToast(opId, type, operation.actionUrl !== null)
    }

    const terminal = new Promise<BillingOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)

    void poll(opId)

    return terminal
  }

  async function poll(opId: string) {
    const inFlight = inFlightPolls.get(opId)
    if (inFlight) {
      await inFlight
      return
    }

    const request = pollOnce(opId).finally(() => {
      inFlightPolls.delete(opId)
    })
    inFlightPolls.set(opId, request)
    await request
  }

  async function pollOnce(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    pausePolling(opId)
    if (operation.isAuthenticating) return

    if (stopIfTimedOut(opId, operation)) return

    if (operation.workspaceId !== workspaceStore.activeWorkspaceId) {
      scheduleNextPoll(opId)
      return
    }

    try {
      const response = await workspaceApi.getBillingOpStatus(opId)
      const currentOperation = operations.value.get(opId)
      if (currentOperation !== operation) return
      if (operation.workspaceId !== workspaceStore.activeWorkspaceId) {
        if (stopIfTimedOut(opId, operation)) return
        scheduleNextPoll(opId)
        return
      }

      if (response.status === 'succeeded') {
        await handleSuccess(opId)
        return
      }

      if (response.status === 'failed') {
        handleFailure(opId, response.error_message ?? null)
        return
      }

      if (
        flags.embeddedCheckoutEnabled &&
        (response.status === 'reconciliation_needed' ||
          response.authentication_state === 'reconciliation_needed')
      ) {
        handleReconciliationNeeded(opId)
        return
      }

      if (stopIfTimedOut(opId, operation)) return

      const pollingPaused = flags.embeddedCheckoutEnabled
        ? await updateAuthenticationState(
            opId,
            response.authentication_state,
            response.payment_intent_client_secret,
            response.decline_reason
          )
        : false
      updateOperationActionUrl(opId, validateActionUrl(response.action_url))
      if (pollingPaused) return
      scheduleNextPoll(opId)
    } catch {
      const currentOperation = operations.value.get(opId)
      if (currentOperation !== operation) return
      if (stopIfTimedOut(opId, currentOperation)) return
      scheduleNextPoll(opId)
    }
  }

  function pollPendingOperations() {
    for (const operation of operations.value.values()) {
      if (
        operation.workspaceId === workspaceStore.activeWorkspaceId &&
        operation.status === 'pending' &&
        !operation.isAuthenticating
      ) {
        pausePolling(operation.opId)
        void poll(operation.opId)
      }
    }
  }

  // The slow cadence is for an operation parked on the customer: a challenge
  // to complete elsewhere, or a failed attempt awaiting their retry. Once this
  // tab's own challenge completes, the state reads processing and nothing
  // waits on the customer anymore — holding the slow cadence there left a
  // settled payment spinning for half a minute.
  function isParkedAwaitingCustomer(operation: BillingOperation): boolean {
    return (
      operation.authenticationState === 'requires_action' ||
      operation.actionUrl !== null ||
      (operation.authenticationState === 'failed_retryable' &&
        operation.authenticationRequiredSeen)
    )
  }

  function scheduleNextPoll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    // One chain per operation: an explicit retry polls immediately while a
    // scheduled poll may still be armed, and two chains would double the
    // request rate and race each other's state writes.
    pausePolling(opId)
    const nextInterval = isParkedAwaitingCustomer(operation)
      ? ACTION_REQUIRED_INTERVAL_MS
      : Math.min(
          (intervals.get(opId) ?? INITIAL_INTERVAL_MS) * BACKOFF_MULTIPLIER,
          MAX_INTERVAL_MS
        )
    intervals.set(opId, nextInterval)

    const timeoutId = setTimeout(() => void poll(opId), nextInterval)
    timeouts.set(opId, timeoutId)
  }

  function validateActionUrl(value: string | undefined): string | null {
    if (!value) return null
    try {
      const url = new URL(value)
      return url.protocol === 'https:' ? value : null
    } catch {
      return null
    }
  }

  function hasTimedOut(operation: BillingOperation): boolean {
    const elapsed = Date.now() - operation.startedAt
    if (operation.type !== 'cancel' && operation.authenticationRequiredSeen) {
      return elapsed > AUTHENTICATION_TIMEOUT_MS
    }
    return operation.type === 'subscription'
      ? elapsed > SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS
      : elapsed > TIMEOUT_MS
  }

  async function updateAuthenticationState(
    opId: string,
    state?: BillingAuthenticationState,
    clientSecret?: string,
    declineReason?: BillingDeclineReason
  ): Promise<boolean> {
    if (!state) return false
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return true

    const knownSecret = paymentIntentClientSecrets.get(opId)
    if (clientSecret) paymentIntentClientSecrets.set(opId, clientSecret)
    const secret = clientSecret ?? knownSecret
    // requires_action after a failed browser attempt is the same challenge the
    // customer just abandoned — the intent has not moved. Keeping the retry
    // presentation stops the failure alert and button label flapping between
    // polls; a state that actually advanced (processing, succeeded, failed)
    // still flows through and resolves the UI.
    //
    // Likewise after a browser attempt that SUCCEEDED: the server can keep
    // reporting requires_action for the same intent until it observes the
    // completion, and downgrading processing back to requires_action reopened
    // the pay button mid-payment. A different client secret is a genuinely
    // new challenge and still flows through.
    const isEchoOfHandledChallenge =
      state === 'requires_action' &&
      operation.authenticationState === 'processing' &&
      autoHandledPaymentActions.has(opId) &&
      (!clientSecret || clientSecret === knownSecret)
    const displayState =
      state === 'requires_action' &&
      (operation.authenticationState === 'failed_retryable' ||
        isEchoOfHandledChallenge)
        ? operation.authenticationState
        : state
    const declineDetail =
      state === 'failed_retryable' && declineReason
        ? billingFailureDetail(operation.type, declineReason)
        : null
    updateOperation(opId, {
      authenticationState: displayState,
      canRetryAuthentication:
        Boolean(secret) &&
        (displayState === 'requires_action' ||
          displayState === 'failed_retryable'),
      authenticationRequiredSeen:
        operation.authenticationRequiredSeen || state === 'requires_action',
      ...(declineDetail && { errorMessage: declineDetail })
    })

    // Neither authentication state is terminal for a pending operation: the
    // customer may complete the challenge on a hosted page or another device,
    // and the server learns before this tab does. Polling therefore continues
    // at the slower authentication cadence until the operation settles or times
    // out — pausing here left a completed payment showing "complete
    // verification" forever.
    if (state === 'failed_retryable') return false
    if (
      state !== 'requires_action' ||
      !operation.autoHandleRequiresAction ||
      autoHandledPaymentActions.has(opId)
    ) {
      return false
    }
    // Only the in-page challenge we drive ourselves suspends polling, for as
    // long as it is on screen.
    autoHandledPaymentActions.add(opId)
    return !(await runPaymentIntentAction(opId))
  }

  async function retryPaymentAuthentication(opId: string): Promise<boolean> {
    if (!flags.embeddedCheckoutEnabled) return false
    const operation = operations.value.get(opId)
    if (
      !operation ||
      operation.status !== 'pending' ||
      !paymentIntentClientSecrets.has(opId) ||
      !operation.canRetryAuthentication
    ) {
      return false
    }
    const completed = await runPaymentIntentAction(opId)
    if (completed) void poll(opId)
    return completed
  }

  async function runPaymentIntentAction(opId: string): Promise<boolean> {
    const operation = operations.value.get(opId)
    const clientSecret = paymentIntentClientSecrets.get(opId)
    if (!operation || !clientSecret || operation.isAuthenticating) return false
    updateOperation(opId, {
      isAuthenticating: true,
      canRetryAuthentication: false,
      errorMessage: null
    })

    try {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      const stripe = publishableKey ? await loadStripe(publishableKey) : null
      if (!stripe) {
        setAuthenticationRetry(
          opId,
          t('billingOperation.authenticationUnavailable'),
          false
        )
        return false
      }
      const result = await stripe.handleNextAction({ clientSecret })
      if (result.error) {
        setAuthenticationRetry(
          opId,
          result.error.message ||
            t('billingOperation.authenticationFailedDetail')
        )
        return false
      }
      updateOperation(opId, {
        authenticationState: 'processing',
        isAuthenticating: false,
        canRetryAuthentication: false,
        errorMessage: null,
        actionUrl: null
      })
      autoHandledPaymentActions.add(opId)
      intervals.set(opId, INITIAL_INTERVAL_MS)
      return true
    } catch (error) {
      setAuthenticationRetry(
        opId,
        error instanceof Error
          ? error.message
          : t('billingOperation.authenticationFailedDetail')
      )
      return false
    }
  }

  function setAuthenticationRetry(
    opId: string,
    errorMessage: string,
    canRetry = true
  ) {
    const operation = operations.value.get(opId)
    if (!operation) return
    updateOperation(opId, {
      authenticationState: 'failed_retryable',
      isAuthenticating: false,
      canRetryAuthentication: canRetry && paymentIntentClientSecrets.has(opId),
      errorMessage
    })
    // A browser-step error is not a verdict on the payment: the challenge may
    // have completed server-side despite the client error (observed: the
    // intent succeeded seconds after handleNextAction reported failure, and a
    // paused UI stayed on "failed" for a live subscription). Keep polling so
    // the server's state resolves the presentation; the retry button remains
    // the manual path while it is genuinely parked.
    scheduleNextPoll(opId)
  }

  function updateOperation(opId: string, patch: Partial<BillingOperation>) {
    const operation = operations.value.get(opId)
    if (!operation) return
    operations.value = new Map(operations.value).set(opId, {
      ...operation,
      ...patch
    })
  }

  function pausePolling(opId: string) {
    const timeoutId = timeouts.get(opId)
    if (timeoutId) clearTimeout(timeoutId)
    timeouts.delete(opId)
  }

  function stopIfTimedOut(opId: string, operation: BillingOperation): boolean {
    if (!hasTimedOut(operation)) return false
    handleTimeout(opId)
    return true
  }

  function updateOperationActionUrl(opId: string, actionUrl: string | null) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    // An action link echoed while this tab's completed challenge is still
    // processing points at that same challenge; surfacing it would ask the
    // customer to redo a step they just finished.
    if (
      actionUrl !== null &&
      autoHandledPaymentActions.has(opId) &&
      operation.authenticationState !== 'requires_action'
    ) {
      return
    }
    operations.value = new Map(operations.value).set(opId, {
      ...operation,
      actionUrl,
      authenticationRequiredSeen:
        operation.authenticationRequiredSeen || actionUrl !== null
    })
    // Tracks the CURRENT action_url, which the contract defines as present
    // exactly while the operation cannot proceed without the customer — so the
    // toast never outlives the verification action it points at. Swapped only
    // when that answer changes, or a dismissed toast would return every poll.
    const wasActionRequired = operation.actionUrl !== null
    const isActionRequired = actionUrl !== null
    if (operation.type !== 'cancel' && wasActionRequired !== isActionRequired) {
      showProgressToast(opId, operation.type, isActionRequired)
    }
  }

  async function handleSuccess(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    updateOperationStatus(opId, 'succeeded', null)
    cleanup(opId)

    const telemetry = useTelemetry()
    const now = Date.now()
    const operationDurationMs = now - operation.operationStartedAt
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'succeeded',
      outcome: 'success',
      billing_op_id: opId,
      operation_type: operation.type,
      tier: operation.tier,
      cycle: operation.cycle,
      checkout_type: operation.checkoutType,
      payment_intent_source: operation.paymentIntentSource,
      duration_ms: operationDurationMs
    })

    if (
      operation.type === 'subscription' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      const durationMs = now - operation.businessAttemptStartedAt
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        billing_op_id: opId,
        duration_ms: durationMs
      })
      // Also fires the legacy event for providers (Mixpanel, GTM) that don't
      // implement trackBillingEvent. Gated to actual new/upgraded
      // subscriptions — a downgrade-to-personal is churn, not a conversion,
      // and this event drives a GA4 "subscription succeeded" conversion goal.
      if (!operation.downgradeToPersonal) {
        telemetry?.trackMonthlySubscriptionSucceeded({
          tier: operation.tier,
          cycle: operation.cycle,
          checkout_type: operation.checkoutType,
          payment_intent_source: operation.paymentIntentSource,
          billing_op_id: opId
        })
      }
    } else if (
      operation.type === 'topup' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: opId,
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    // Mirrors handleFailure's structure: not gated on businessAttemptStartedAt,
    // since a downgrade always has its own startedAt for duration_ms below.
    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        duration_ms: now - operation.downgradeToPersonal.startedAt
      })
    }

    const billingContext = useBillingContext()
    const capabilities = useBillingCapabilities()
    if (operation.type === 'subscription') {
      await Promise.allSettled([
        billingContext.reconcileSubscriptionSuccess(),
        capabilities.refresh()
      ])
    } else {
      await Promise.allSettled([
        billingContext.fetchStatus(),
        billingContext.fetchBalance(),
        capabilities.refresh()
      ])
    }

    if (operation.type === 'cancel') {
      useTeamWorkspaceStore().updateActiveWorkspace({ isSubscribed: false })
      resolveTerminal(opId)
      return
    }

    // A subscription checkout shows its own success step in the pricing dialog,
    // so leave it open. Top-ups have no such step: close and surface settings.
    if (operation.type === 'topup') {
      useDialogStore().closeDialog({ key: 'top-up-credits' })
      useSettingsDialog().show(isCloud ? 'workspace' : 'credits')
    }

    const toastStore = useToastStore()
    const messageKey =
      operation.type === 'subscription'
        ? 'billingOperation.subscriptionSuccess'
        : 'billingOperation.topupSuccess'

    toastStore.add({
      severity: 'success',
      summary: t(messageKey),
      life: 5000
    })

    resolveTerminal(opId)
  }

  function handleFailure(opId: string, errorMessage: string | null) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const superseded = errorMessage === CHECKOUT_SUPERSEDED_REASON
    const defaultMessage = failureMessage(operation.type)
    const detail = billingFailureDetail(operation.type, errorMessage)

    updateOperationStatus(opId, 'failed', detail ?? defaultMessage)
    cleanup(opId)

    const telemetry = useTelemetry()
    const now = Date.now()
    const failureCategory = superseded
      ? 'stale_operation'
      : categorizePollFailure(
          operation.type,
          errorMessage,
          Boolean(operation.downgradeToPersonal)
        )
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: opId,
      operation_type: operation.type,
      tier: operation.tier,
      cycle: operation.cycle,
      checkout_type: operation.checkoutType,
      payment_intent_source: operation.paymentIntentSource,
      failure_category: failureCategory,
      duration_ms: now - operation.operationStartedAt
    })
    if (
      operation.type === 'subscription' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        billing_op_id: opId,
        failure_category: failureCategory,
        duration_ms: now - operation.businessAttemptStartedAt
      })
    } else if (
      operation.type === 'topup' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        failure_category: failureCategory,
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        failure_category: failureCategory,
        duration_ms: now - operation.downgradeToPersonal.startedAt
      })
    }

    if (operation.type !== 'cancel' && !superseded) {
      useToastStore().add({
        severity: 'error',
        summary: defaultMessage,
        detail: detail ?? undefined,
        life: 7000
      })
    }

    resolveTerminal(opId)
  }

  function handleReconciliationNeeded(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return
    updateOperation(opId, {
      status: 'reconciliation_needed',
      authenticationState: 'reconciliation_needed',
      canRetryAuthentication: false,
      isAuthenticating: false,
      errorMessage: null,
      actionUrl: null
    })
    cleanup(opId)

    const telemetry = useTelemetry()
    const now = Date.now()
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: opId,
      operation_type: operation.type,
      tier: operation.tier,
      cycle: operation.cycle,
      checkout_type: operation.checkoutType,
      payment_intent_source: operation.paymentIntentSource,
      failure_category: 'reconciliation_needed',
      duration_ms: now - operation.operationStartedAt
    })
    if (
      operation.type === 'subscription' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        billing_op_id: opId,
        failure_category: 'reconciliation_needed',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    } else if (
      operation.type === 'topup' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        failure_category: 'reconciliation_needed',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    resolveTerminal(opId)
  }

  function handleTimeout(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const message = timeoutMessage(operation.type)

    updateOperationStatus(opId, 'timeout', message)
    cleanup(opId)

    const telemetry = useTelemetry()
    const now = Date.now()
    telemetry?.trackBillingEvent({
      operation: 'operation',
      stage: 'timeout',
      outcome: 'failure',
      billing_op_id: opId,
      operation_type: operation.type,
      tier: operation.tier,
      cycle: operation.cycle,
      checkout_type: operation.checkoutType,
      payment_intent_source: operation.paymentIntentSource,
      failure_category: 'poll_timeout',
      duration_ms: now - operation.operationStartedAt
    })
    if (
      operation.type === 'subscription' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'failed',
        outcome: 'failure',
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        billing_op_id: opId,
        failure_category: 'poll_timeout',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    } else if (
      operation.type === 'topup' &&
      operation.businessAttemptStartedAt !== undefined
    ) {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        failure_category: 'poll_timeout',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        failure_category: 'poll_timeout',
        duration_ms: now - operation.downgradeToPersonal.startedAt
      })
    }

    if (operation.type !== 'cancel') {
      useToastStore().add({
        severity: 'error',
        summary: message
      })
    }

    resolveTerminal(opId)
  }

  /**
   * No caught JS error here — only the backend's free-form `error_message`, if
   * any. `cancel` and zero-payment operations (e.g. downgrade-to-personal,
   * which removes members / changes tier but never touches a card) can't be a
   * provider decline, so they're always an api rejection. For payment-bearing
   * `subscription`/`topup` polls, a message naming a connectivity/system
   * failure isn't a decline either; only fall back to `provider_decline` when
   * the backend gave no more specific signal.
   */
  function categorizePollFailure(
    type: OperationType,
    errorMessage: string | null,
    isZeroPaymentOperation: boolean
  ): BillingFailure['failure_category'] {
    if (type === 'cancel' || isZeroPaymentOperation) return 'api_rejected'

    if (errorMessage && /network|connection|unreachable/i.test(errorMessage)) {
      return 'network'
    }

    return 'provider_decline'
  }

  function failureMessage(type: OperationType) {
    if (type === 'subscription') return t('billingOperation.subscriptionFailed')
    if (type === 'topup') return t('billingOperation.topupFailed')
    return t('billingOperation.cancelFailed')
  }

  function billingFailureDetail(
    type: OperationType,
    errorMessage: string | null
  ) {
    switch (errorMessage) {
      case 'insufficient_funds':
        return t('billingOperation.insufficientFundsDetail')
      case 'expired_card':
        return t('billingOperation.expiredCardDetail')
      case 'incorrect_cvc':
      case 'invalid_cvc':
        return t('billingOperation.incorrectCvcDetail')
      case 'authentication_failed':
      case 'authentication_required':
      case 'payment_intent_authentication_failure':
        return t('billingOperation.authenticationFailedDetail')
      case 'processing_error':
      case 'issuer_not_available':
      case 'try_again_later':
        return t('billingOperation.processingErrorDetail')
      case 'card_declined':
      case 'generic_decline':
      case 'approve_with_id':
      case 'call_issuer':
      case 'do_not_honor':
      case 'do_not_try_again':
      case 'not_permitted':
      case 'restricted_card':
      case 'security_violation':
      case 'service_not_allowed':
      case 'transaction_not_allowed':
      case 'initial_subscription_rejected':
      case 'subscribe_invoice_payment_failed':
      case 'topup_payment_declined':
      case 'topup_invoice_payment_failed':
      case 'upgrade_payment_declined':
      case 'upgrade_invoice_payment_failed':
      case 'team_credit_raise_payment_declined':
      case 'reset_now_payment_declined':
      case 'reset_now_invoice_payment_failed':
        return t('billingOperation.paymentDeclinedDetail')
    }
    if (type === 'subscription')
      return t('billingOperation.subscriptionFailedDetail')
    if (type === 'topup' && errorMessage) return t('credits.topUp.unknownError')
    return errorMessage
  }

  function timeoutMessage(type: OperationType) {
    if (type === 'subscription')
      return t('billingOperation.subscriptionTimeout')
    if (type === 'topup') return t('billingOperation.topupTimeout')
    return t('billingOperation.cancelTimeout')
  }

  function resolveTerminal(opId: string) {
    const resolve = terminalResolvers.get(opId)
    const operation = operations.value.get(opId)
    if (resolve && operation) {
      resolve(operation)
    }
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  function updateOperationStatus(
    opId: string,
    status: OperationStatus,
    errorMessage: string | null
  ) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const updated = {
      ...operation,
      status,
      errorMessage,
      actionUrl: null,
      authenticationState: null,
      canRetryAuthentication: false,
      isAuthenticating: false
    }
    operations.value = new Map(operations.value).set(opId, updated)
  }

  function cleanup(opId: string) {
    const timeoutId = timeouts.get(opId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.delete(opId)
    }
    intervals.delete(opId)
    autoHandledPaymentActions.delete(opId)
    paymentIntentClientSecrets.delete(opId)

    // Remove the "received" toast
    const receivedToast = receivedToasts.get(opId)
    if (receivedToast) {
      useToastStore().remove(receivedToast)
      receivedToasts.delete(opId)
    }
  }

  function clearOperation(opId: string) {
    cleanup(opId)
    const newMap = new Map(operations.value)
    newMap.delete(opId)
    operations.value = newMap
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  return {
    operations,
    hasPendingOperations,
    isSettingUp,
    isAddingCredits,
    subscriptionActionOperation,
    topupActionOperation,
    getOperation,
    startOperation,
    retryPaymentAuthentication,
    pollPendingOperations,
    clearOperation
  }
})
