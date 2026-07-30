import type { ToastMessageOptions } from 'primevue/toast'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import type {
  PaymentIntentSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from '@/platform/telemetry/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const INITIAL_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 8000
const ACTION_REQUIRED_INTERVAL_MS = 30_000
const BACKOFF_MULTIPLIER = 1.5
const TIMEOUT_MS = 120_000
const SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS = 5 * 60_000
const SUBSCRIPTION_AUTHENTICATION_TIMEOUT_MS = 23 * 60 * 60_000

type OperationType = 'subscription' | 'topup' | 'cancel'

export interface StartOperationMetadata {
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  downgradeToPersonal?: {
    memberRemovalCount: number
    memberRemovalFailures: number
    targetTier?: TierKey
  }
}

interface BillingOperationBase {
  opId: string
  type: OperationType
  startedAt: number
  actionUrl: string | null
  authenticationRequiredSeen: boolean
  workspaceId: string | null
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkoutType?: SubscriptionCheckoutType
  paymentIntentSource?: PaymentIntentSource
  downgradeToPersonal?: StartOperationMetadata['downgradeToPersonal']
}

interface PendingOperation extends BillingOperationBase {
  status: 'pending'
  errorMessage: null
}

interface SucceededOperation extends BillingOperationBase {
  status: 'succeeded'
  errorMessage: null
  actionUrl: null
}

interface FailedOperation extends BillingOperationBase {
  status: 'failed'
  errorMessage: string
  actionUrl: null
}

interface TimedOutOperation extends BillingOperationBase {
  status: 'timeout'
  errorMessage: string
  actionUrl: null
}

type BillingOperation =
  | PendingOperation
  | SucceededOperation
  | FailedOperation
  | TimedOutOperation

type TerminalOperation =
  | SucceededOperation
  | FailedOperation
  | TimedOutOperation

type TransitionOutcome =
  | { status: 'succeeded' }
  | { status: 'failed'; summary: string; detail: string | undefined }
  | { status: 'timeout'; summary: string }

type TerminalResolver = (operation: TerminalOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const workspaceStore = useTeamWorkspaceStore()
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
  const receivedToasts = new Map<string, ToastMessageOptions>()
  const terminalResolvers = new Map<string, TerminalResolver>()
  const terminalPromises = new Map<string, Promise<TerminalOperation>>()

  const hasPendingOperations = computed(() =>
    [...operations.value.values()].some((op) => op.status === 'pending')
  )

  const isSettingUp = computed(() =>
    [...operations.value.values()].some(
      (op) =>
        op.status === 'pending' &&
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId
    )
  )

  const isAddingCredits = computed(() =>
    [...operations.value.values()].some(
      (op) => op.status === 'pending' && op.type === 'topup'
    )
  )

  const subscriptionActionOperation = computed(() =>
    [...operations.value.values()].find(
      (op) =>
        op.status === 'pending' &&
        op.type === 'subscription' &&
        op.workspaceId === workspaceStore.activeWorkspaceId &&
        op.actionUrl !== null
    )
  )

  function getOperation(opId: string) {
    return operations.value.get(opId)
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
    const operation: PendingOperation = {
      opId,
      type,
      status: 'pending',
      errorMessage: null,
      startedAt: Date.now(),
      actionUrl,
      authenticationRequiredSeen: actionUrl !== null,
      workspaceId: workspaceStore.activeWorkspaceId,
      tier: metadata?.tier,
      cycle: metadata?.cycle,
      checkoutType: metadata?.checkoutType,
      paymentIntentSource: metadata?.paymentIntentSource,
      downgradeToPersonal: metadata?.downgradeToPersonal
    }

    operations.value = new Map(operations.value).set(opId, operation)
    intervals.set(opId, INITIAL_INTERVAL_MS)

    if (type !== 'cancel') {
      const messageKey =
        type === 'subscription'
          ? 'billingOperation.subscriptionProcessing'
          : 'billingOperation.topupProcessing'

      const toastMessage: ToastMessageOptions = {
        severity: 'info',
        summary: t(messageKey),
        group: 'billing-operation'
      }
      receivedToasts.set(opId, toastMessage)
      useToastStore().add(toastMessage)
    }

    const terminal = new Promise<TerminalOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)

    void poll(opId)

    return terminal
  }

  async function poll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return

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
        await transitionToTerminal(opId, { status: 'succeeded' })
        return
      }

      if (response.status === 'failed') {
        await transitionToTerminal(
          opId,
          failureOutcome(operation.type, response.error_message ?? null)
        )
        return
      }

      if (stopIfTimedOut(opId, operation)) return

      updateOperationActionUrl(opId, validateActionUrl(response.action_url))
      scheduleNextPoll(opId)
    } catch {
      const currentOperation = operations.value.get(opId)
      if (currentOperation !== operation) return
      if (stopIfTimedOut(opId, currentOperation)) return
      scheduleNextPoll(opId)
    }
  }

  function scheduleNextPoll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    const nextInterval = operation.authenticationRequiredSeen
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
    if (operation.type !== 'subscription') return elapsed > TIMEOUT_MS
    return operation.authenticationRequiredSeen
      ? elapsed > SUBSCRIPTION_AUTHENTICATION_TIMEOUT_MS
      : elapsed > SUBSCRIPTION_ACTION_DISCOVERY_TIMEOUT_MS
  }

  function stopIfTimedOut(opId: string, operation: BillingOperation): boolean {
    if (!hasTimedOut(operation)) return false
    void transitionToTerminal(opId, {
      status: 'timeout',
      summary: timeoutMessage(operation.type)
    })
    return true
  }

  function updateOperationActionUrl(opId: string, actionUrl: string | null) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return
    operations.value = new Map(operations.value).set(opId, {
      ...operation,
      actionUrl,
      authenticationRequiredSeen:
        operation.authenticationRequiredSeen || actionUrl !== null
    })
  }

  /**
   * Owns the entire pending -> terminal transition: status update, cleanup,
   * telemetry, refresh/side effects, toast, and terminal-promise resolution.
   * The three outcomes (succeeded/failed/timeout) share this one path and
   * differ only in the pieces below that actually differ.
   */
  async function transitionToTerminal(
    opId: string,
    outcome: TransitionOutcome
  ): Promise<void> {
    if (outcome.status === 'succeeded') {
      const operation = updateOperationStatus(opId, outcome)
      if (!operation) return
      cleanup(opId)
      trackSuccessTelemetry(operation)
      await applySuccessSideEffects(operation)
      resolveTerminal(opId, operation)
      return
    }

    const operation = updateOperationStatus(opId, outcome)
    if (!operation) return
    cleanup(opId)
    trackFailureTelemetry(operation, outcome)
    applyFailureToast(operation, outcome)
    resolveTerminal(opId, operation)
  }

  async function applySuccessSideEffects(
    operation: SucceededOperation
  ): Promise<void> {
    const billingContext = useBillingContext()
    if (operation.type === 'subscription') {
      await Promise.allSettled([billingContext.reconcileSubscriptionSuccess()])
    } else {
      await Promise.allSettled([
        billingContext.fetchStatus(),
        billingContext.fetchBalance()
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
      useSettingsDialog().show('workspace')
    }

    const messageKey =
      operation.type === 'subscription'
        ? 'billingOperation.subscriptionSuccess'
        : 'billingOperation.topupSuccess'

    useToastStore().add({
      severity: 'success',
      summary: t(messageKey),
      life: 5000
    })
  }

  function applyFailureToast(
    operation: FailedOperation | TimedOutOperation,
    outcome: Extract<TransitionOutcome, { status: 'failed' | 'timeout' }>
  ) {
    if (operation.type === 'cancel') return

    useToastStore().add({
      severity: 'error',
      summary: outcome.summary,
      detail: outcome.status === 'failed' ? outcome.detail : undefined
    })
  }

  function trackSuccessTelemetry(operation: SucceededOperation) {
    const telemetry = useTelemetry()

    if (operation.type === 'subscription') {
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        billing_op_id: operation.opId
      })
    } else if (operation.type === 'topup') {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: operation.opId
      })
    } else {
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: operation.opId,
        operation_type: 'cancel'
      })
    }

    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier
      })
    }
  }

  function trackFailureTelemetry(
    operation: FailedOperation | TimedOutOperation,
    outcome: Extract<TransitionOutcome, { status: 'failed' | 'timeout' }>
  ) {
    const telemetry = useTelemetry()
    const failureCategory =
      outcome.status === 'timeout' ? 'poll_timeout' : 'unknown'

    if (outcome.status === 'timeout') {
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'timeout',
        outcome: 'failure',
        billing_op_id: operation.opId,
        operation_type: operation.type,
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        failure_category: 'poll_timeout'
      })
    } else {
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: operation.opId,
        operation_type: operation.type,
        tier: operation.tier,
        cycle: operation.cycle,
        checkout_type: operation.checkoutType,
        payment_intent_source: operation.paymentIntentSource,
        failure_category: 'unknown'
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
        failure_category: failureCategory
      })
    }
  }

  function failureOutcome(
    type: OperationType,
    backendMessage: string | null
  ): Extract<TransitionOutcome, { status: 'failed' }> {
    const detail =
      type === 'subscription'
        ? t('billingOperation.subscriptionFailedDetail')
        : (backendMessage ?? undefined)
    return { status: 'failed', summary: failureMessage(type), detail }
  }

  function failureMessage(type: OperationType) {
    if (type === 'subscription') return t('billingOperation.subscriptionFailed')
    if (type === 'topup') return t('billingOperation.topupFailed')
    return t('billingOperation.cancelFailed')
  }

  function timeoutMessage(type: OperationType) {
    if (type === 'subscription')
      return t('billingOperation.subscriptionTimeout')
    if (type === 'topup') return t('billingOperation.topupTimeout')
    return t('billingOperation.cancelTimeout')
  }

  function resolveTerminal(opId: string, operation: TerminalOperation) {
    terminalResolvers.get(opId)?.(operation)
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  /** Applies a transition outcome to the pending operation, returning the new terminal state. */
  function updateOperationStatus(
    opId: string,
    outcome: Extract<TransitionOutcome, { status: 'succeeded' }>
  ): SucceededOperation | undefined
  function updateOperationStatus(
    opId: string,
    outcome: Extract<TransitionOutcome, { status: 'failed' | 'timeout' }>
  ): FailedOperation | TimedOutOperation | undefined
  function updateOperationStatus(
    opId: string,
    outcome: TransitionOutcome
  ): TerminalOperation | undefined {
    const operation = operations.value.get(opId)
    if (!operation) return undefined

    const base = { ...operation, actionUrl: null } as const
    const updated: TerminalOperation =
      outcome.status === 'succeeded'
        ? { ...base, status: 'succeeded', errorMessage: null }
        : outcome.status === 'failed'
          ? {
              ...base,
              status: 'failed',
              errorMessage: outcome.detail ?? outcome.summary
            }
          : { ...base, status: 'timeout', errorMessage: outcome.summary }

    operations.value = new Map(operations.value).set(opId, updated)
    return updated
  }

  function cleanup(opId: string) {
    const timeoutId = timeouts.get(opId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.delete(opId)
    }
    intervals.delete(opId)

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
    getOperation,
    startOperation,
    clearOperation
  }
})
