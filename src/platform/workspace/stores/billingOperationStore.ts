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
const PENDING_OPERATION_STORAGE_KEY = 'comfy.billing.pending_operation'

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

interface PendingBillingOperation {
  opId: string
  type: 'subscription'
  startedAt: number
  returnUrl: string
  paymentNavigationStarted: boolean
}

interface StartOperationOptions {
  hostedInvoiceReturnUrl?: string
}

type TerminalResolver = (operation: BillingOperation) => void

export const useBillingOperationStore = defineStore('billingOperation', () => {
  const operations = ref<Map<string, BillingOperation>>(new Map())
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>()
  const intervals = new Map<string, number>()
  const receivedToasts = new Map<string, ToastMessageOptions>()
  const terminalResolvers = new Map<string, TerminalResolver>()
  const terminalPromises = new Map<string, Promise<BillingOperation>>()
  const pollsInFlight = new Set<string>()

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
    options: StartOperationOptions = {}
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
      returnUrl: getSameOriginUrl(options.hostedInvoiceReturnUrl),
      paymentNavigationStarted: false
    }

    operations.value = new Map(operations.value).set(opId, operation)
    intervals.set(opId, INITIAL_INTERVAL_MS)
    persistPendingOperation(operation)

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

    const terminal = createTerminalPromise(opId)

    void poll(opId)

    return terminal
  }

  async function poll(opId: string) {
    const operation = operations.value.get(opId)
    if (
      !operation ||
      operation.status !== 'pending' ||
      pollsInFlight.has(opId)
    ) {
      return
    }

    if (Date.now() - operation.startedAt > TIMEOUT_MS) {
      handleTimeout(opId)
      return
    }

    pollsInFlight.add(opId)
    try {
      const response = await workspaceApi.getBillingOpStatus(opId)
      const currentOperation = operations.value.get(opId)
      if (!currentOperation || currentOperation.status !== 'pending') return

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
        !currentOperation.paymentNavigationStarted &&
        currentOperation.returnUrl
      ) {
        beginPaymentNavigation(opId, response.customer_action.url)
        return
      }

      scheduleNextPoll(opId)
    } catch {
      const currentOperation = operations.value.get(opId)
      if (!currentOperation || currentOperation.status !== 'pending') return
      if (Date.now() - currentOperation.startedAt > TIMEOUT_MS) {
        handleTimeout(opId)
        return
      }
      scheduleNextPoll(opId)
    } finally {
      pollsInFlight.delete(opId)
    }
  }

  function scheduleNextPoll(opId: string) {
    const currentInterval = intervals.get(opId) ?? INITIAL_INTERVAL_MS
    const nextInterval = Math.min(
      currentInterval * BACKOFF_MULTIPLIER,
      MAX_INTERVAL_MS
    )
    intervals.set(opId, nextInterval)

    const timeoutId = setTimeout(() => {
      if (timeouts.get(opId) === timeoutId) timeouts.delete(opId)
      void poll(opId)
    }, nextInterval)
    timeouts.set(opId, timeoutId)
  }

  async function handleSuccess(opId: string) {
    const operation = operations.value.get(opId)
    if (!operation) return

    updateOperationStatus(opId, 'succeeded', null)
    cleanup(opId)
    clearPendingOperation(opId)

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
    clearPendingOperation(opId)

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
    clearPendingOperation(opId)

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

  function createTerminalPromise(opId: string) {
    const terminal = new Promise<BillingOperation>((resolve) => {
      terminalResolvers.set(opId, resolve)
    })
    terminalPromises.set(opId, terminal)
    return terminal
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

  function beginPaymentNavigation(opId: string, paymentUrl: string) {
    const operation = operations.value.get(opId)
    if (!operation?.returnUrl) return

    const updated = { ...operation, paymentNavigationStarted: true }
    if (!persistPendingOperation(updated)) {
      handleFailure(opId, null)
      return
    }
    operations.value = new Map(operations.value).set(opId, updated)
    globalThis.location.assign(paymentUrl)
  }

  function persistPendingOperation(operation: BillingOperation): boolean {
    if (operation.type !== 'subscription' || !operation.returnUrl) return false

    const pendingOperation: PendingBillingOperation = {
      opId: operation.opId,
      type: operation.type,
      startedAt: operation.startedAt,
      returnUrl: operation.returnUrl,
      paymentNavigationStarted: operation.paymentNavigationStarted
    }

    try {
      localStorage.setItem(
        PENDING_OPERATION_STORAGE_KEY,
        JSON.stringify(pendingOperation)
      )
      return true
    } catch {
      return false
    }
  }

  function getSameOriginUrl(value: string | undefined): string | null {
    if (!value) return null

    try {
      const url = new URL(value)
      return url.origin === globalThis.location.origin ? url.href : null
    } catch {
      return null
    }
  }

  function clearPendingOperation(opId: string) {
    try {
      const pendingOperation = readPendingOperation()
      if (pendingOperation?.opId === opId) {
        localStorage.removeItem(PENDING_OPERATION_STORAGE_KEY)
      }
    } catch {
      return
    }
  }

  function readPendingOperation(): PendingBillingOperation | null {
    let value: string | null
    try {
      value = localStorage.getItem(PENDING_OPERATION_STORAGE_KEY)
    } catch {
      return null
    }
    if (!value) return null

    try {
      const candidate: unknown = JSON.parse(value)
      if (!candidate || typeof candidate !== 'object') return null
      if (
        !('opId' in candidate) ||
        typeof candidate.opId !== 'string' ||
        !('type' in candidate) ||
        candidate.type !== 'subscription' ||
        !('startedAt' in candidate) ||
        typeof candidate.startedAt !== 'number' ||
        !('returnUrl' in candidate) ||
        typeof candidate.returnUrl !== 'string' ||
        !('paymentNavigationStarted' in candidate) ||
        typeof candidate.paymentNavigationStarted !== 'boolean'
      ) {
        return null
      }

      const returnUrl = new URL(candidate.returnUrl)
      if (returnUrl.origin !== globalThis.location.origin) return null

      return {
        opId: candidate.opId,
        type: candidate.type,
        startedAt: candidate.startedAt,
        returnUrl: returnUrl.href,
        paymentNavigationStarted: candidate.paymentNavigationStarted
      }
    } catch {
      return null
    }
  }

  function recoverPendingOperation() {
    const pendingOperation = readPendingOperation()
    if (!pendingOperation || operations.value.has(pendingOperation.opId)) return

    const operation: BillingOperation = {
      ...pendingOperation,
      status: 'pending',
      errorMessage: null,
      startedAt: Date.now()
    }
    operations.value = new Map(operations.value).set(operation.opId, operation)
    intervals.set(operation.opId, INITIAL_INTERVAL_MS)
    void createTerminalPromise(operation.opId)
    void poll(operation.opId)
  }

  function cleanup(opId: string) {
    const timeoutId = timeouts.get(opId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeouts.delete(opId)
    }
    intervals.delete(opId)
    pollsInFlight.delete(opId)

    // Remove the "received" toast
    const receivedToast = receivedToasts.get(opId)
    if (receivedToast) {
      useToastStore().remove(receivedToast)
      receivedToasts.delete(opId)
    }
  }

  function clearOperation(opId: string) {
    cleanup(opId)
    clearPendingOperation(opId)
    const newMap = new Map(operations.value)
    newMap.delete(opId)
    operations.value = newMap
    terminalResolvers.delete(opId)
    terminalPromises.delete(opId)
  }

  recoverPendingOperation()

  function resumePendingOperations() {
    for (const operation of operations.value.values()) {
      if (
        operation.status === 'pending' &&
        operation.paymentNavigationStarted &&
        !timeouts.has(operation.opId)
      ) {
        updateOperationStatus(operation.opId, 'pending', null)
        const resumed = operations.value.get(operation.opId)
        if (resumed) {
          operations.value = new Map(operations.value).set(operation.opId, {
            ...resumed,
            startedAt: Date.now()
          })
        }
        void poll(operation.opId)
      }
    }
  }

  return {
    operations,
    hasPendingOperations,
    isSettingUp,
    isAddingCredits,
    getOperation,
    startOperation,
    recoverPendingOperation,
    resumePendingOperations,
    clearOperation
  }
})
