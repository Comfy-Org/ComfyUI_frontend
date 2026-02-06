import { onBeforeUnmount, ref } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

const INITIAL_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 8000
const BACKOFF_MULTIPLIER = 1.5
const TIMEOUT_MS = 120_000 // 2 minutes

interface UseBillingPollingOptions {
  onSuccess?: () => void | Promise<void>
  onError?: (errorMessage: string) => void
  /** Custom message shown when operation fails (default: 'Operation failed') */
  failedMessage?: string
  /** Custom message shown when polling times out (default: 'Operation verification timed out') */
  timeoutMessage?: string
  /** Custom message shown when status check fails (default: 'Failed to verify operation status') */
  errorMessage?: string
}

export function useBillingPolling(options: UseBillingPollingOptions = {}) {
  const {
    onSuccess,
    onError,
    failedMessage = 'Operation failed',
    timeoutMessage = 'Operation verification timed out',
    errorMessage: errorMessageText = 'Failed to verify operation status'
  } = options

  const isPending = ref(false)
  const isSuccess = ref(false)
  const isFailed = ref(false)
  const isTimeout = ref(false)
  const errorMessage = ref<string | null>(null)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentOpId: string | null = null
  let startTime: number | null = null
  let currentInterval = INITIAL_INTERVAL_MS

  function resetState() {
    isPending.value = false
    isSuccess.value = false
    isFailed.value = false
    isTimeout.value = false
    errorMessage.value = null
    currentOpId = null
    startTime = null
    currentInterval = INITIAL_INTERVAL_MS
  }

  function stopPolling() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    currentOpId = null
  }

  function handleTimeout() {
    isPending.value = false
    isFailed.value = true
    isTimeout.value = true
    errorMessage.value = timeoutMessage
    stopPolling()
    onError?.(errorMessage.value)
  }

  function scheduleNextPoll() {
    currentInterval = Math.min(
      currentInterval * BACKOFF_MULTIPLIER,
      MAX_INTERVAL_MS
    )
    timeoutId = setTimeout(() => void poll(), currentInterval)
  }

  async function poll() {
    if (!currentOpId || startTime === null) return

    if (Date.now() - startTime > TIMEOUT_MS) {
      handleTimeout()
      return
    }

    try {
      const response = await workspaceApi.getBillingOpStatus(currentOpId)

      if (response.status === 'succeeded') {
        isPending.value = false
        isSuccess.value = true
        stopPolling()
        await onSuccess?.()
        return
      }

      if (response.status === 'failed') {
        isPending.value = false
        isFailed.value = true
        errorMessage.value = response.error_message ?? failedMessage
        stopPolling()
        onError?.(errorMessage.value)
        return
      }

      scheduleNextPoll()
    } catch {
      if (startTime !== null && Date.now() - startTime > TIMEOUT_MS) {
        isPending.value = false
        isFailed.value = true
        errorMessage.value = errorMessageText
        stopPolling()
        onError?.(errorMessage.value)
        return
      }

      scheduleNextPoll()
    }
  }

  function startPolling(billingOpId: string) {
    stopPolling()
    resetState()
    isPending.value = true
    currentOpId = billingOpId
    startTime = Date.now()
    currentInterval = INITIAL_INTERVAL_MS
    void poll()
  }

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    isPending,
    isSuccess,
    isFailed,
    isTimeout,
    errorMessage,
    startPolling,
    stopPolling
  }
}
