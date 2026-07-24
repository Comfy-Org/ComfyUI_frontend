import type { ToastMessageOptions } from 'primevue/toast'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const INITIAL_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 8000
const BACKOFF_MULTIPLIER = 1.5
const TIMEOUT_MS = 120_000 // 2 minutes
const PENDING_OPERATIONS_STORAGE_KEY = 'comfy.billing.pendingOperations'

type OperationType = 'subscription' | 'topup' | 'cancel'
type OperationStatus = 'pending' | 'succeeded' | 'failed' | 'timeout'

interface BillingOperation {
  opId: string
  type: OperationType
  status: OperationStatus
  errorMessage: string | null
  startedAt: number
  returnUrl: string | null
  paymentNavigationStarted: boolean
}

type PersistedBillingOperation = Pick<
  BillingOperation,
  'opId' | 'type' | 'startedAt' | 'returnUrl' | 'paymentNavigationStarted'
>

type TerminalResolver = (operation: BillingOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const operations = ref<Map<string, BillingOperation>>(
    new Map(
      readPendingOperations().map((operation) => [
        operation.opId,
        {
          ...operation,
          status: 'pending',
          errorMessage: null,
          startedAt: Date.now()
        }
      ])
    )
  )
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
  const polling = new Set<string>()
  const receivedToasts = new Map<string, ToastMessageOptions>()
  const terminalResolvers = new Map<string, TerminalResolver>()
  const terminalPromises = new Map<string, Promise<BillingOperation>>()

  const hasPendingOperations = computed(() =>
    [...operations.value.values()].some((op) => op.status === 'pending')
  )

  const isSettingUp = computed(() =>
    [...operations.value.values()].some(
      (op) => op.status === 'pending' && op.type === 'subscription'
    )
  )

  const isAddingCredits = computed(() =>
    [...operations.value.values()].some(
      (op) => op.status === 'pending' && op.type === 'topup'
    )
  )

  function getOperation(opId: string) {
    return operations.value.get(opId)
  }

  function startOperation(
    opId: string,
    type: OperationType,
    returnUrl: string | null = null
  ): Promise<BillingOperation> {
    const existing = operations.value.get(opId)
    if (existing) {
      return terminalPromises.get(opId) ?? Promise.resolve(existing)
    }

    const operation: BillingOperation = {
      opId,
      type,
      status: 'pending',
      errorMessage: null,
      startedAt: Date.now(),
      returnUrl,
      paymentNavigationStarted: false
    }

    operations.value = new Map(operations.value).set(opId, operation)
    persistPendingOperations()
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

    const terminal = new Promise<BillingOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)

    void poll(opId)

    return terminal
  }

  async function poll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending' || polling.has(opId))
      return

    polling.add(opId)

    if (Date.now() - operation.startedAt > TIMEOUT_MS) {
      handleTimeout(opId)
      polling.delete(opId)
      return
    }

    try {
      const response = await workspaceApi.getBillingOpStatus(opId)

      if (response.status === 'succeeded') {
        await handleSuccess(opId)
        return
      }

      if (response.status === 'failed') {
        handleFailure(opId, response.error_message ?? null)
        return
      }

      if (
        response.customer_action?.type === 'pay_hosted_invoice' &&
        !operation.paymentNavigationStarted &&
        isSafePaymentUrl(response.customer_action.url)
      ) {
        updatePaymentNavigationStarted(opId)
        window.location.assign(response.customer_action.url)
        return
      }

      scheduleNextPoll(opId)
    } catch {
      if (Date.now() - operation.startedAt > TIMEOUT_MS) {
        handleTimeout(opId)
        return
      }
      scheduleNextPoll(opId)
    } finally {
      polling.delete(opId)
    }
  }

  function scheduleNextPoll(opId: string) {
    const currentInterval = intervals.get(opId) ?? INITIAL_INTERVAL_MS
    const nextInterval = Math.min(
      currentInterval * BACKOFF_MULTIPLIER,
      MAX_INTERVAL_MS
    )
    intervals.set(opId, nextInterval)

    const timeoutId = setTimeout(() => void poll(opId), nextInterval)
    timeouts.set(opId, timeoutId)
  }

  async function handleSuccess(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    updateOperationStatus(opId, 'succeeded', null)
    cleanup(opId)

    if (operation.type === 'subscription') {
      useTelemetry()?.trackMonthlySubscriptionSucceeded()
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
      resolveTerminal(opId)
      return
    }

    // A subscription checkout shows its own success step in the pricing dialog,
    // so leave it open. Top-ups have no such step: close and surface settings.
    if (operation.type === 'topup') {
      useDialogStore().closeDialog({ key: 'top-up-credits' })
      useSettingsDialog().show('workspace')
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

    const defaultMessage = failureMessage(operation.type)

    updateOperationStatus(opId, 'failed', errorMessage ?? defaultMessage)
    cleanup(opId)

    if (operation.type !== 'cancel') {
      useToastStore().add({
        severity: 'error',
        summary: defaultMessage,
        detail: errorMessage ?? undefined
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

    if (operation.type !== 'cancel') {
      useToastStore().add({
        severity: 'error',
        summary: message
      })
    }

    resolveTerminal(opId)
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

  function updateOperationStatus(
    opId: string,
    status: OperationStatus,
    errorMessage: string | null
  ) {
    const operation = operations.value.get(opId)
    if (!operation) return

    const updated = { ...operation, status, errorMessage }
    operations.value = new Map(operations.value).set(opId, updated)
    persistPendingOperations()
  }

  function updatePaymentNavigationStarted(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    operations.value = new Map(operations.value).set(opId, {
      ...operation,
      paymentNavigationStarted: true
    })
    persistPendingOperations()
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
    persistPendingOperations()
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  function resumePendingOperations() {
    for (const [opId, operation] of operations.value) {
      if (operation.status !== 'pending') continue
      intervals.set(opId, INITIAL_INTERVAL_MS)
      void poll(opId)
    }
  }

  function persistPendingOperations() {
    const pendingOperations: PersistedBillingOperation[] = [
      ...operations.value.values()
    ]
      .filter((operation) => operation.status === 'pending')
      .map(
        ({ opId, type, startedAt, returnUrl, paymentNavigationStarted }) => ({
          opId,
          type,
          startedAt,
          returnUrl,
          paymentNavigationStarted
        })
      )

    try {
      if (pendingOperations.length === 0) {
        localStorage.removeItem(PENDING_OPERATIONS_STORAGE_KEY)
      } else {
        localStorage.setItem(
          PENDING_OPERATIONS_STORAGE_KEY,
          JSON.stringify(pendingOperations)
        )
      }
    } catch {
      return
    }
  }

  resumePendingOperations()

  return {
    operations,
    hasPendingOperations,
    isSettingUp,
    isAddingCredits,
    getOperation,
    startOperation,
    resumePendingOperations,
    clearOperation
  }
})

function readPendingOperations(): PersistedBillingOperation[] {
  try {
    const stored = localStorage.getItem(PENDING_OPERATIONS_STORAGE_KEY)
    if (!stored) return []

    const value: unknown = JSON.parse(stored)
    if (!Array.isArray(value)) return []

    return value.filter(isPersistedBillingOperation)
  } catch {
    return []
  }
}

function isPersistedBillingOperation(
  value: unknown
): value is PersistedBillingOperation {
  if (!value || typeof value !== 'object') return false

  const operation = value as Record<string, unknown>
  return (
    typeof operation.opId === 'string' &&
    ['subscription', 'topup', 'cancel'].includes(String(operation.type)) &&
    typeof operation.startedAt === 'number' &&
    (operation.returnUrl === null || typeof operation.returnUrl === 'string') &&
    typeof operation.paymentNavigationStarted === 'boolean'
  )
}

function isSafePaymentUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
