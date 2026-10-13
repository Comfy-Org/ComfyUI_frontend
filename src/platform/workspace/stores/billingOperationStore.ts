import type {
  BillingTelemetryEvent,
  BillingTelemetryFailure,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from '@comfyorg/account-core/billing'
import type { PaymentIntent } from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { customerCanActHere } from '@comfyorg/account-core/billing'
import { useEventListener } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type {
  BillingAuthenticationState,
  BillingOperationPhase,
  BillingDeclineReason,
  BillingRecoveryAction
} from '@/platform/workspace/api/workspaceApi'
import type {
  ProgressToast,
  ProgressToastKind
} from '@/platform/workspace/billing/customerAttention'
import {
  isBlockedOnCustomerPhase,
  isParkedCheckout,
  legacyOperationActionHold,
  needsCustomerAttention,
  progressToastKind
} from '@/platform/workspace/billing/customerAttention'
import { resolveStripePublishableKey } from '@/platform/workspace/billing/stripePublishableKey'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  getCheckoutJourneyPaymentIntentSource
} from '@/platform/workspace/utils/checkoutJourney'
import { useDialogStore } from '@/stores/dialogStore'

const INITIAL_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 8000
const ACTION_REQUIRED_INTERVAL_MS = 30_000
// Twenty turns of the backend's 3 s PaymentIntent status cache.
const ACTION_DISCOVERY_WINDOW_MS = 60_000
const BACKOFF_MULTIPLIER = 1.5
const TIMEOUT_MS = 120_000
const SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS = 5 * 60_000
const AUTHENTICATION_TIMEOUT_MS = 23 * 60 * 60_000
// Failure reason for a checkout the user replaced by picking a different plan
// mid-flow. The operation is terminal-failed only because it never completed —
// its replacement is proceeding normally, so there is nothing to report.
const CHECKOUT_SUPERSEDED_REASON = 'checkout_superseded'
// Statuses that mean the resumed challenge left the intent exactly where it
// started, so the attempt needs a fresh start rather than a poll. A denylist
// fails toward the server rather than toward the customer: an unlisted or
// future Stripe status reports optimistically as processing, which the next
// poll's own authentication_state corrects if that guess was wrong — unlike
// an allowlist, where the same gap would report a live payment as failed.
const UNMOVED_INTENT_STATUSES: ReadonlySet<PaymentIntent.Status> = new Set([
  'requires_payment_method',
  'requires_action',
  'canceled'
])

// The poller adopts only operations the legacy rail issued; the SDK rail settles its own.
function trackLegacyBillingEvent(event: BillingTelemetryEvent) {
  useTelemetry()?.trackBillingEvent({ ...event, billing_client: 'legacy' })
}

type OperationType = 'subscription' | 'topup' | 'cancel' | 'retention'
type PaymentOperationType = Extract<OperationType, 'subscription' | 'topup'>

function isPaymentOperation(type: OperationType): type is PaymentOperationType {
  return type === 'subscription' || type === 'topup'
}

type OperationStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'reconciliation_needed'

export interface StartOperationMetadata {
  workspaceId?: string
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  suppressProcessingToast?: boolean
  /**
   * Adopted from a status read rather than started by the customer here. The
   * read names the operation but not what it waits on, so without a served
   * link it is announced by its first status, never before it.
   */
  resumed?: boolean
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
  // Latches once the server has reported a phase blocked on the customer. The
  // phase itself moves on — an invoice being finalised reports in_progress —
  // and elapsed time is counted from the start, so re-reading it would measure
  // the whole parked wait against the short budget the moment it advances.
  blockedOnCustomerSeen: boolean
  workspaceId: string | null
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  autoHandleRequiresAction: boolean
  // Last phase the server reported for a pending operation. The phases
  // isBlockedOnCustomerPhase names will not advance until the customer acts, so
  // a dialog should offer them a way back rather than keep waiting. Null while
  // unknown — the field is optional in the contract, and absent is explicitly
  // no claim, never an implied in_progress.
  phase: BillingOperationPhase | null
  downgradeToPersonal?: StartOperationMetadata['downgradeToPersonal']
  // Set when the customer walked away from this operation in the UI (e.g.
  // "Start over" after a failed challenge). The operation itself is not
  // over — only the server decides that — so it keeps polling and can still
  // resolve normally; this only hides it from the selectors a dialog reads.
  dismissed: boolean
}

type TerminalResolver = (operation: BillingOperation) => void

interface FailureRecovery {
  readonly action?: BillingRecoveryAction
  // The contract's authority on whether starting another operation can succeed.
  readonly retryable?: boolean
}

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const workspaceStore = useTeamWorkspaceStore()
  const { flags } = useFeatureFlags()
  const toast = useToast()
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
  const waitingWithoutActionSince = new Map<string, number>()
  const progressToasts = new Map<string, ProgressToast>()
  const progressToastsAwaitingFirstRead = new Set<string>()
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
        !isParkedCheckout(op) &&
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const isAddingCredits = computed(() =>
    [...operations.value.values()].some(
      (op) =>
        op.status === 'pending' &&
        op.authenticationState !== 'failed_retryable' &&
        !op.dismissed &&
        op.type === 'topup' &&
        op.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const subscriptionActionOperation = computed(() =>
    [...operations.value.values()].find(
      (op) =>
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId &&
        needsCustomerAttention(op)
    )
  )

  const topupActionOperation = computed(() =>
    [...operations.value.values()].find(
      (op) =>
        op.type === 'topup' &&
        op.workspaceId === workspaceStore.activeWorkspaceId &&
        !op.dismissed &&
        needsCustomerAttention(op)
    )
  )

  function getOperation(opId: string) {
    return operations.value.get(opId)
  }

  // An operation parked on a bank challenge is waiting on the customer, not on
  // us, so it must not keep announcing "processing" — that reads as "nothing to
  // do here" next to the verification prompt the same state renders.
  function syncProgressToast(
    opId: string,
    type: PaymentOperationType,
    kind: ProgressToastKind | undefined
  ) {
    const previous = progressToasts.get(opId)
    if (previous?.kind === kind) return
    if (previous) {
      toast.dismiss(previous.id)
      progressToasts.delete(opId)
    }
    if (kind === undefined) return

    const messageKey =
      type === 'subscription'
        ? kind === 'action'
          ? 'billingOperation.subscriptionActionRequired'
          : 'billingOperation.subscriptionProcessing'
        : kind === 'action'
          ? 'billingOperation.topupActionRequired'
          : 'billingOperation.topupProcessing'

    const id =
      kind === 'action'
        ? toast.warning(t(messageKey))
        : toast.loading(t(messageKey))
    progressToasts.set(opId, { kind, id })
  }

  function announceStart(
    operation: BillingOperation,
    metadata: StartOperationMetadata | undefined
  ) {
    if (
      !isPaymentOperation(operation.type) ||
      metadata?.suppressProcessingToast
    )
      return
    if (metadata?.resumed && operation.actionUrl === null) {
      progressToastsAwaitingFirstRead.add(operation.opId)
      return
    }
    syncProgressToast(
      operation.opId,
      operation.type,
      progressToastKind(operation)
    )
  }

  // The action URL is the last field a read applies, so an operation awaiting
  // its first read is announced here by what that read found.
  function syncProgressToastAfterRead(
    before: BillingOperation,
    after: BillingOperation
  ) {
    if (
      isPaymentOperation(after.type) &&
      progressToastsAwaitingFirstRead.delete(after.opId)
    ) {
      syncProgressToast(after.opId, after.type, progressToastKind(after))
      return
    }
    syncProgressToastOnChange(before, after)
  }

  function syncProgressToastOnChange(
    before: BillingOperation,
    after: BillingOperation
  ) {
    if (!isPaymentOperation(after.type)) return
    const kind = progressToastKind(after)
    if (kind !== progressToastKind(before)) {
      syncProgressToast(after.opId, after.type, kind)
    }
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
      blockedOnCustomerSeen: false,
      workspaceId: metadata?.workspaceId ?? workspaceStore.activeWorkspaceId,
      tier: metadata?.tier,
      cycle: metadata?.cycle,
      checkoutType: metadata?.checkoutType,
      paymentIntentSource:
        metadata?.paymentIntentSource ??
        getCheckoutJourneyPaymentIntentSource(opId),
      autoHandleRequiresAction: metadata?.autoHandleRequiresAction ?? false,
      phase: null,
      downgradeToPersonal: metadata?.downgradeToPersonal,
      dismissed: false
    }

    operations.value = new Map(operations.value).set(opId, operation)
    intervals.set(opId, INITIAL_INTERVAL_MS)

    if (metadata?.attemptStartedAt === undefined) {
      trackLegacyBillingEvent({
        operation: 'operation',
        stage: 'started',
        outcome: 'pending',
        operation_type: type
      })
    }

    announceStart(operation, metadata)

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
        handleFailure(opId, response.error_message ?? null, {
          action: response.recovery_action,
          retryable: response.retryable
        })
        return
      }

      if (
        response.status === 'reconciliation_needed' ||
        (flags.embeddedCheckoutEnabled &&
          response.authentication_state === 'reconciliation_needed')
      ) {
        handleReconciliationNeeded(opId)
        return
      }

      // The phase can widen the budget, so it is applied before the decision,
      // which then reads the updated operation. The action URL stays after it:
      // a link landing on an operation already out of budget is not retained.
      updateOperationPhase(opId, response.phase ?? null)
      if (stopIfTimedOut(opId, operations.value.get(opId) ?? operation)) return

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
  function isWaitingOnCustomer(operation: BillingOperation): boolean {
    return (
      isBlockedOnCustomerPhase(operation.phase) ||
      operation.authenticationState === 'requires_action' ||
      operation.actionUrl !== null ||
      (operation.authenticationState === 'failed_retryable' &&
        operation.authenticationRequiredSeen)
    )
  }

  // Parked straight away only while the customer can act here. The server can
  // report a blocked phase and a client secret before its cached
  // authentication_state catches up, so an actionless wait keeps the backoff
  // for the discovery window. Past it the action is not coming to this tab (a
  // member without billing permission, embedded checkout off) and it parks.
  function isParkedAwaitingCustomer(
    operation: BillingOperation,
    waitedWithoutActionMs: number
  ): boolean {
    if (!isWaitingOnCustomer(operation)) return false
    return (
      customerCanAct(operation) ||
      waitedWithoutActionMs >= ACTION_DISCOVERY_WINDOW_MS
    )
  }

  function trackWaitWithoutAction(operation: BillingOperation): number {
    if (!isWaitingOnCustomer(operation) || customerCanAct(operation)) {
      waitingWithoutActionSince.delete(operation.opId)
      return 0
    }
    const now = Date.now()
    const since = waitingWithoutActionSince.get(operation.opId) ?? now
    waitingWithoutActionSince.set(operation.opId, since)
    return now - since
  }

  function customerCanAct(operation: BillingOperation): boolean {
    return customerCanActHere(
      legacyOperationActionHold(
        operation,
        paymentIntentClientSecrets.has(operation.opId)
      )
    )
  }

  function scheduleNextPoll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    // One chain per operation: an explicit retry polls immediately while a
    // scheduled poll may still be armed, and two chains would double the
    // request rate and race each other's state writes.
    pausePolling(opId)
    const nextInterval = isParkedAwaitingCustomer(
      operation,
      trackWaitWithoutAction(operation)
    )
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
    if (
      isPaymentOperation(operation.type) &&
      (operation.authenticationRequiredSeen || operation.blockedOnCustomerSeen)
    ) {
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
    // customer just abandoned — the intent has not moved. Keeping the failure
    // presentation stops the alert flapping between polls; a state that
    // actually advanced (processing, succeeded, failed) still flows through and
    // resolves the UI. A different client secret is a genuinely new challenge
    // and still flows through — same rule the echo check below applies.
    //
    // Likewise after a browser attempt that SUCCEEDED: the server can keep
    // reporting requires_action for the same intent until it observes the
    // completion, and downgrading processing back to requires_action reopened
    // the pay button mid-payment.
    const isStaleFailure =
      state === 'requires_action' &&
      operation.authenticationState === 'failed_retryable' &&
      (!clientSecret || clientSecret === knownSecret)
    const isEchoOfHandledChallenge =
      state === 'requires_action' &&
      operation.authenticationState === 'processing' &&
      autoHandledPaymentActions.has(opId) &&
      (!clientSecret || clientSecret === knownSecret)
    const displayState =
      isStaleFailure || isEchoOfHandledChallenge
        ? operation.authenticationState
        : state
    const declineDetail =
      state === 'failed_retryable' && declineReason
        ? billingFailureDetail(operation.type, declineReason)
        : null
    updateOperation(opId, {
      authenticationState: displayState,
      canRetryAuthentication:
        Boolean(secret) && displayState === 'requires_action',
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
      operation.authenticationState !== 'requires_action'
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
      const publishableKey = resolveStripePublishableKey()
      const stripe = publishableKey ? await loadStripe(publishableKey) : null
      if (!stripe) {
        setAuthenticationFailed(
          opId,
          t('billingOperation.authenticationUnavailable')
        )
        return false
      }
      const { error, paymentIntent } = await stripe.handleNextAction({
        clientSecret
      })
      if (error) {
        setAuthenticationFailed(
          opId,
          error.message || t('billingOperation.authenticationFailedDetail')
        )
        return false
      }
      // With no action left to resume the call succeeds and changes nothing, so
      // an intent still sitting on its pre-challenge status has not paid.
      if (paymentIntent && UNMOVED_INTENT_STATUSES.has(paymentIntent.status)) {
        setAuthenticationFailed(
          opId,
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
      waitingWithoutActionSince.delete(opId)
      return true
    } catch (error) {
      setAuthenticationFailed(
        opId,
        error instanceof Error
          ? error.message
          : t('billingOperation.authenticationFailedDetail')
      )
      return false
    }
  }

  function setAuthenticationFailed(opId: string, errorMessage: string) {
    const operation = operations.value.get(opId)
    if (!operation) return
    updateOperation(opId, {
      authenticationState: 'failed_retryable',
      isAuthenticating: false,
      canRetryAuthentication: false,
      errorMessage
    })
    // A browser-step error is not a verdict on the payment: the challenge may
    // have completed server-side despite the client error (observed: the
    // intent succeeded seconds after handleNextAction reported failure, and a
    // paused UI stayed on "failed" for a live subscription). Keep polling so
    // the server's state resolves the presentation.
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

  function updateOperationPhase(
    opId: string,
    phase: BillingOperationPhase | null
  ) {
    const operation = operations.value.get(opId)
    if (
      !operation ||
      operation.status !== 'pending' ||
      operation.phase === phase
    ) {
      return
    }
    const updated: BillingOperation = {
      ...operation,
      phase,
      blockedOnCustomerSeen:
        operation.blockedOnCustomerSeen || isBlockedOnCustomerPhase(phase)
    }
    operations.value = new Map(operations.value).set(opId, updated)
    syncProgressToastOnChange(operation, updated)
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
    const updated: BillingOperation = {
      ...operation,
      actionUrl,
      authenticationRequiredSeen:
        operation.authenticationRequiredSeen || actionUrl !== null
    }
    operations.value = new Map(operations.value).set(opId, updated)
    // Tracks the CURRENT action_url, which the contract defines as present
    // exactly while the operation cannot proceed without the customer — so the
    // toast never outlives the verification action it points at. Swapped only
    // when that answer changes, or a dismissed toast would return every poll.
    syncProgressToastAfterRead(operation, updated)
  }

  async function handleSuccess(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    updateOperationStatus(opId, 'succeeded', null)

    if (getActiveCheckoutJourney()?.billing_op_id === opId) {
      clearCheckoutJourney()
    }

    try {
      cleanup(opId)

      const telemetry = useTelemetry()
      const now = Date.now()
      const operationDurationMs = now - operation.operationStartedAt
      trackLegacyBillingEvent({
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
        trackLegacyBillingEvent({
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
        trackLegacyBillingEvent({
          operation: 'topup',
          stage: 'succeeded',
          outcome: 'success',
          billing_op_id: opId,
          payment_intent_source: operation.paymentIntentSource,
          duration_ms: now - operation.businessAttemptStartedAt
        })
      }
      // Mirrors handleFailure's structure: not gated on businessAttemptStartedAt,
      // since a downgrade always has its own startedAt for duration_ms below.
      if (operation.downgradeToPersonal) {
        trackLegacyBillingEvent({
          operation: 'downgrade_to_personal',
          stage: 'succeeded',
          outcome: 'success',
          member_removal_count:
            operation.downgradeToPersonal.memberRemovalCount,
          member_removal_failures:
            operation.downgradeToPersonal.memberRemovalFailures,
          target_tier: operation.downgradeToPersonal.targetTier,
          duration_ms: now - operation.downgradeToPersonal.startedAt
        })
      }

      if (operation.type === 'retention') return

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
        return
      }

      // A subscription checkout shows its own success step in the pricing dialog,
      // so leave it open. Top-ups have no such step: close and surface settings.
      if (operation.type === 'topup') {
        useDialogStore().closeDialog({ key: 'top-up-credits' })
        useSettingsDialog().show(isCloud ? 'workspace' : 'credits')
      }

      const messageKey =
        operation.type === 'subscription'
          ? 'billingOperation.subscriptionSuccess'
          : 'billingOperation.topupSuccess'

      toast.success(t(messageKey), { duration: 5000 })
    } catch (error) {
      reportError(error, {
        surface: 'billing',
        errorType: 'failure_handling_billing_operation_success',
        context: { billing_op_id: opId }
      })
      throw error
    } finally {
      resolveTerminal(opId)
    }
  }

  function handleFailure(
    opId: string,
    errorMessage: string | null,
    recovery?: FailureRecovery
  ) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const superseded = errorMessage === CHECKOUT_SUPERSEDED_REASON
    const defaultMessage = failureMessage(operation.type)
    // A recovery action describes a card the customer must re-present. An
    // operation that never charges one — a cancellation, a downgrade — cannot
    // be recovered that way whatever the server reports.
    const chargesACard =
      isPaymentOperation(operation.type) && !operation.downgradeToPersonal
    const detail = billingFailureDetail(
      operation.type,
      errorMessage,
      chargesACard ? recovery : undefined
    )

    updateOperationStatus(opId, 'failed', detail ?? defaultMessage)
    cleanup(opId)

    const now = Date.now()
    const failureCategory = superseded
      ? 'stale_operation'
      : categorizePollFailure(
          operation.type,
          errorMessage,
          Boolean(operation.downgradeToPersonal)
        )
    trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        payment_intent_source: operation.paymentIntentSource,
        failure_category: failureCategory,
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    if (operation.downgradeToPersonal) {
      trackLegacyBillingEvent({
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

    if (isPaymentOperation(operation.type) && !superseded) {
      toast.error(defaultMessage, {
        description: detail ?? undefined,
        duration: 7000
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

    const now = Date.now()
    trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        payment_intent_source: operation.paymentIntentSource,
        failure_category: 'reconciliation_needed',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    if (operation.downgradeToPersonal) {
      trackLegacyBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        failure_category: 'reconciliation_needed',
        duration_ms: now - operation.downgradeToPersonal.startedAt
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

    const now = Date.now()
    trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
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
      trackLegacyBillingEvent({
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: opId,
        payment_intent_source: operation.paymentIntentSource,
        failure_category: 'poll_timeout',
        duration_ms: now - operation.businessAttemptStartedAt
      })
    }
    if (operation.downgradeToPersonal) {
      trackLegacyBillingEvent({
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

    if (isPaymentOperation(operation.type)) {
      toast.error(message)
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
  ): BillingTelemetryFailure['failure_category'] {
    if (!isPaymentOperation(type) || isZeroPaymentOperation)
      return 'api_rejected'

    if (errorMessage && /network|connection|unreachable/i.test(errorMessage)) {
      return 'network'
    }

    return 'provider_decline'
  }

  function failureMessage(type: OperationType) {
    if (type === 'retention') return t('subscription.retentionOffer.failed')
    if (type === 'subscription') return t('billingOperation.subscriptionFailed')
    if (type === 'topup') return t('billingOperation.topupFailed')
    return t('billingOperation.cancelFailed')
  }

  function billingFailureDetail(
    type: OperationType,
    errorMessage: string | null,
    recovery?: FailureRecovery
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
      case 'payment_not_completed':
      case 'payment_method_customer_decline':
      case 'payment_intent_payment_attempt_expired':
        return t('billingOperation.authenticationFailedDetail')
      case 'subscribe_method_not_chargeable_off_session':
        // `recovery` is withheld from operations that never charge a card.
        if (recovery) {
          return t('billingOperation.methodNotChargeableOffSessionDetail')
        }
        break
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
    // Reached only when no coded reason named something more actionable. A
    // terminal operation is served no action_url, so this copy must promise no
    // button — and no retry unless the server says another attempt can work.
    if (recovery?.action === 'authenticate_payment') {
      return t(
        recovery.retryable === false
          ? 'billingOperation.authenticatePaymentBlockedDetail'
          : 'billingOperation.authenticatePaymentDetail'
      )
    }
    if (type === 'subscription')
      return t('billingOperation.subscriptionFailedDetail')
    if (type === 'topup' && errorMessage) return t('credits.topUp.unknownError')
    return errorMessage
  }

  function timeoutMessage(type: OperationType) {
    if (type === 'retention')
      return t('subscription.retentionOffer.unconfirmed')
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
    waitingWithoutActionSince.delete(opId)
    autoHandledPaymentActions.delete(opId)
    paymentIntentClientSecrets.delete(opId)
    progressToastsAwaitingFirstRead.delete(opId)

    const progressToast = progressToasts.get(opId)
    if (progressToast) {
      toast.dismiss(progressToast.id)
      progressToasts.delete(opId)
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

  // Unlike clearOperation, this keeps the operation live: polling continues
  // and a late success or failure still resolves normally. It only removes
  // the operation from the selectors a dialog reads, since whether the
  // customer wants to see it is a view concern — whether it is over is not.
  // A server-side cancel (BE-10064/BE-11559) would let a dismissal actually
  // end the operation instead of merely hiding it; call that here once it
  // exists.
  function dismissOperation(opId: string) {
    updateOperation(opId, { dismissed: true })
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
    clearOperation,
    dismissOperation
  }
})
