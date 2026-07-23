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
const REDIRECT_OPERATION_STORAGE_KEY = 'Comfy.BillingRedirectOperation'

type OperationType = 'subscription' | 'topup' | 'cancel'
type OperationStatus = 'pending' | 'succeeded' | 'failed' | 'timeout'

interface BillingOperation {
  opId: string
  type: OperationType
  status: OperationStatus
  errorMessage: string | null
  startedAt: number
}

interface PersistedRedirectOperation {
  opId: string
  type: OperationType
}

type TerminalResolver = (operation: BillingOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
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
    type: OperationType
  ): Promise<BillingOperation> {
    const existing = operations.value.get(opId)
    if (existing) {
      if (existing.status !== 'pending') {
        clearOperation(opId)
        return startOperation(opId, type)
      }
      return terminalPromises.get(opId) ?? Promise.resolve(existing)
    }

    const operation: BillingOperation = {
      opId,
      type,
      status: 'pending',
      errorMessage: null,
      startedAt: Date.now()
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

    const terminal = new Promise<BillingOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)

    void poll(opId)

    return terminal
  }

  function beginRedirectOperation(opId: string, type: OperationType) {
    try {
      localStorage.setItem(
        REDIRECT_OPERATION_STORAGE_KEY,
        JSON.stringify({ opId, type } satisfies PersistedRedirectOperation)
      )
    } catch {
      return
    }
  }

  function restoreRedirectOperation() {
    let persisted: string | null
    try {
      persisted = localStorage.getItem(REDIRECT_OPERATION_STORAGE_KEY)
    } catch {
      return
    }
    if (!persisted) return

    try {
      const operation: unknown = JSON.parse(persisted)
      if (!isPersistedRedirectOperation(operation)) {
        localStorage.removeItem(REDIRECT_OPERATION_STORAGE_KEY)
        return
      }
      void startOperation(operation.opId, operation.type)
    } catch {
      localStorage.removeItem(REDIRECT_OPERATION_STORAGE_KEY)
    }
  }

  function isPersistedRedirectOperation(
    value: unknown
  ): value is PersistedRedirectOperation {
    if (!value || typeof value !== 'object') return false
    if (!('opId' in value) || typeof value.opId !== 'string') return false
    if (!('type' in value)) return false
    return value.type === 'subscription' || value.type === 'topup'
  }

  async function poll(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation || operation.status !== 'pending') return

    if (Date.now() - operation.startedAt > TIMEOUT_MS) {
      handleTimeout(opId)
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

      scheduleNextPoll(opId)
    } catch {
      if (Date.now() - operation.startedAt > TIMEOUT_MS) {
        handleTimeout(opId)
        return
      }
      scheduleNextPoll(opId)
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
    clearPersistedRedirectOperation(opId)
  }

  function clearPersistedRedirectOperation(opId: string) {
    try {
      const persisted = localStorage.getItem(REDIRECT_OPERATION_STORAGE_KEY)
      if (!persisted) return
      const operation: unknown = JSON.parse(persisted)
      if (isPersistedRedirectOperation(operation) && operation.opId === opId) {
        localStorage.removeItem(REDIRECT_OPERATION_STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(REDIRECT_OPERATION_STORAGE_KEY)
    }
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
    getOperation,
    startOperation,
    beginRedirectOperation,
    restoreRedirectOperation,
    clearOperation
  }
})
