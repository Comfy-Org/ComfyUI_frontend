import type { ToastMessageOptions } from 'primevue/toast'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Actor, SnapshotFrom } from 'xstate'
import { createActor, fromPromise } from 'xstate'

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
import { nextIntervalMs } from '@/platform/workspace/machines/billingOperationActions'
import type { BillingOperationType } from '@/platform/workspace/machines/billingOperationContext'
import {
  INITIAL_INTERVAL_MS,
  validateActionUrl
} from '@/platform/workspace/machines/billingOperationContext'
import { timeoutBudgetMs } from '@/platform/workspace/machines/billingOperationGuards'
import { billingOperationMachine } from '@/platform/workspace/machines/billingOperationMachine'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

/**
 * Selects the polling driver. Temporary scaffolding for the migration to
 * billingOperationMachine; to be replaced by a real feature flag and then
 * removed along with the legacy driver.
 */
const USE_BILLING_OPERATION_MACHINE = false

type OperationType = BillingOperationType
type OperationStatus = 'pending' | 'succeeded' | 'failed' | 'timeout'

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

interface BillingOperation {
  opId: string
  type: OperationType
  status: OperationStatus
  errorMessage: string | null
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

type BillingOperationActor = Actor<typeof billingOperationMachine>
type BillingOperationSnapshot = SnapshotFrom<typeof billingOperationMachine>
type TerminalResolver = (operation: BillingOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const workspaceStore = useTeamWorkspaceStore()
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const metadataById = new Map<string, StartOperationMetadata>()
  const receivedToasts = new Map<string, ToastMessageOptions>()
  const terminalResolvers = new Map<string, TerminalResolver>()
  const terminalPromises = new Map<string, Promise<BillingOperation>>()

  // Legacy driver state.
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()

  // Machine driver state.
  const actors = new Map<string, BillingOperationActor>()

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
    if (existing) {
      return terminalPromises.get(opId) ?? Promise.resolve(existing)
    }

    if (metadata) metadataById.set(opId, metadata)

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

    const terminal = new Promise<BillingOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)

    if (USE_BILLING_OPERATION_MACHINE) {
      startWithMachine(opId, type, initialActionUrl)
    } else {
      startWithPolling(opId, type, metadata, initialActionUrl)
    }

    return terminal
  }

  // Machine driver ------------------------------------------------------------

  function snapshotStatus(snapshot: BillingOperationSnapshot): OperationStatus {
    if (snapshot.matches('succeeded')) return 'succeeded'
    if (snapshot.matches('failed')) return 'failed'
    if (snapshot.matches('timedOut')) return 'timeout'
    return 'pending'
  }

  function project(snapshot: BillingOperationSnapshot): BillingOperation {
    const { context } = snapshot
    const status = snapshotStatus(snapshot)
    return {
      opId: context.opId,
      type: context.type,
      status,
      errorMessage: projectErrorMessage(
        status,
        context.type,
        context.backendErrorMessage
      ),
      startedAt: context.startedAt,
      actionUrl: context.actionUrl,
      authenticationRequiredSeen: context.authenticationRequiredSeen,
      workspaceId: context.workspaceId,
      ...metadataById.get(context.opId)
    }
  }

  function commit(snapshot: BillingOperationSnapshot) {
    const operation = project(snapshot)
    operations.value = new Map(operations.value).set(operation.opId, operation)
  }

  function startWithMachine(
    opId: string,
    type: OperationType,
    initialActionUrl?: string
  ) {
    const actor = createActor(
      billingOperationMachine.provide({
        actors: {
          fetchStatus: fromPromise(({ input }: { input: { opId: string } }) =>
            workspaceApi.getBillingOpStatus(input.opId)
          )
        },
        guards: {
          isWorkspaceInactive: ({ context }) =>
            context.workspaceId !== workspaceStore.activeWorkspaceId
        }
      }),
      {
        input: {
          opId,
          type,
          workspaceId: workspaceStore.activeWorkspaceId,
          startedAt: Date.now(),
          initialActionUrl
        }
      }
    )

    actors.set(opId, actor)
    commit(actor.getSnapshot())

    actor.subscribe((snapshot) => {
      commit(snapshot)
      if (snapshot.status === 'done') {
        void finalize(opId, snapshot.context.backendErrorMessage)
      }
    })

    actor.start()
  }

  // Legacy driver -------------------------------------------------------------

  function startWithPolling(
    opId: string,
    type: OperationType,
    metadata?: StartOperationMetadata,
    initialActionUrl?: string
  ) {
    const actionUrl = validateActionUrl(initialActionUrl)
    const operation: BillingOperation = {
      opId,
      type,
      status: 'pending',
      errorMessage: null,
      startedAt: Date.now(),
      actionUrl,
      authenticationRequiredSeen: actionUrl !== null,
      workspaceId: workspaceStore.activeWorkspaceId,
      ...metadata
    }

    operations.value = new Map(operations.value).set(opId, operation)
    intervals.set(opId, INITIAL_INTERVAL_MS)

    void poll(opId)
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
        updateOperationStatus(opId, 'succeeded', null)
        void finalize(opId, null)
        return
      }

      if (response.status === 'failed') {
        const backendErrorMessage = response.error_message ?? null
        updateOperationStatus(
          opId,
          'failed',
          projectErrorMessage('failed', operation.type, backendErrorMessage)
        )
        void finalize(opId, backendErrorMessage)
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
    const nextInterval = nextIntervalMs({
      ...operation,
      intervalMs: intervals.get(opId) ?? INITIAL_INTERVAL_MS,
      backendErrorMessage: null,
      readNow: Date.now
    })
    intervals.set(opId, nextInterval)

    const timeoutId = setTimeout(() => void poll(opId), nextInterval)
    timeouts.set(opId, timeoutId)
  }

  function stopIfTimedOut(opId: string, operation: BillingOperation): boolean {
    if (Date.now() - operation.startedAt <= timeoutBudgetMs(operation)) {
      return false
    }
    updateOperationStatus(opId, 'timeout', timeoutMessage(operation.type))
    void finalize(opId, null)
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

  function updateOperationStatus(
    opId: string,
    status: OperationStatus,
    errorMessage: string | null
  ) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const updated = { ...operation, status, errorMessage, actionUrl: null }
    operations.value = new Map(operations.value).set(opId, updated)
  }

  // Shared terminal effects ---------------------------------------------------

  function failureDetail(
    type: OperationType,
    backendErrorMessage: string | null
  ) {
    return type === 'subscription'
      ? t('billingOperation.subscriptionFailedDetail')
      : backendErrorMessage
  }

  function projectErrorMessage(
    status: OperationStatus,
    type: OperationType,
    backendErrorMessage: string | null
  ): string | null {
    if (status === 'timeout') return timeoutMessage(type)
    if (status !== 'failed') return null
    return failureDetail(type, backendErrorMessage) ?? failureMessage(type)
  }

  async function finalize(opId: string, backendErrorMessage: string | null) {
    const operation = operations.value.get(opId)
    if (!operation) return

    cleanup(opId)

    if (operation.status === 'succeeded') await handleSuccess(operation)
    else if (operation.status === 'failed')
      handleFailure(operation, backendErrorMessage)
    else handleTimeout(operation)

    resolveTerminal(opId)
  }

  async function handleSuccess(operation: BillingOperation) {
    const opId = operation.opId
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
        billing_op_id: opId
      })
      if (operation.downgradeToPersonal) {
        telemetry?.trackBillingEvent({
          operation: 'downgrade_to_personal',
          stage: 'succeeded',
          outcome: 'success',
          member_removal_count:
            operation.downgradeToPersonal.memberRemovalCount,
          member_removal_failures:
            operation.downgradeToPersonal.memberRemovalFailures,
          target_tier: operation.downgradeToPersonal.targetTier
        })
      }
    } else if (operation.type === 'topup') {
      telemetry?.trackBillingEvent({
        operation: 'topup',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: opId
      })
    } else {
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        billing_op_id: opId,
        operation_type: 'cancel'
      })
    }

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

  function handleFailure(
    operation: BillingOperation,
    backendErrorMessage: string | null
  ) {
    const telemetry = useTelemetry()
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
    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        failure_category: 'unknown'
      })
    }

    if (operation.type === 'cancel') return

    useToastStore().add({
      severity: 'error',
      summary: failureMessage(operation.type),
      detail: failureDetail(operation.type, backendErrorMessage) ?? undefined
    })
  }

  function handleTimeout(operation: BillingOperation) {
    const telemetry = useTelemetry()
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
    if (operation.downgradeToPersonal) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: operation.downgradeToPersonal.memberRemovalCount,
        member_removal_failures:
          operation.downgradeToPersonal.memberRemovalFailures,
        target_tier: operation.downgradeToPersonal.targetTier,
        failure_category: 'poll_timeout'
      })
    }

    if (operation.type === 'cancel') return

    useToastStore().add({
      severity: 'error',
      summary: timeoutMessage(operation.type)
    })
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

  function resolveTerminal(opId: string) {
    const resolve = terminalResolvers.get(opId)
    const operation = operations.value.get(opId)
    if (resolve && operation) {
      resolve(operation)
    }
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  function cleanup(opId: string) {
    const timeoutId = timeouts.get(opId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.delete(opId)
    }
    intervals.delete(opId)

    const receivedToast = receivedToasts.get(opId)
    if (receivedToast) {
      useToastStore().remove(receivedToast)
      receivedToasts.delete(opId)
    }
  }

  function clearOperation(opId: string) {
    cleanup(opId)
    actors.get(opId)?.stop()
    actors.delete(opId)
    metadataById.delete(opId)
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
