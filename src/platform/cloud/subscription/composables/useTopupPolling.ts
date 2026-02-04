import { onBeforeUnmount, ref } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

const MAX_ATTEMPTS = 100
const POLL_INTERVAL_MS = 300

interface UseTopupPollingOptions {
  onSuccess?: () => void | Promise<void>
  onError?: (errorMessage: string) => void
}

export function useTopupPolling(options: UseTopupPollingOptions = {}) {
  const { onSuccess, onError } = options

  const isPending = ref(false)
  const isSuccess = ref(false)
  const isFailed = ref(false)
  const errorMessage = ref<string | null>(null)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentAttempt = 0
  let currentOpId: string | null = null

  function resetState() {
    isPending.value = false
    isSuccess.value = false
    isFailed.value = false
    errorMessage.value = null
    currentAttempt = 0
    currentOpId = null
  }

  function stopPolling() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    currentOpId = null
  }

  async function poll() {
    if (!currentOpId) return

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
        errorMessage.value = response.error_message ?? 'Top-up failed'
        stopPolling()
        onError?.(errorMessage.value)
        return
      }

      currentAttempt += 1
      if (currentAttempt >= MAX_ATTEMPTS) {
        isPending.value = false
        isFailed.value = true
        errorMessage.value = 'Top-up verification timed out'
        stopPolling()
        onError?.(errorMessage.value)
        return
      }

      timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    } catch (error) {
      currentAttempt += 1
      if (currentAttempt >= MAX_ATTEMPTS) {
        isPending.value = false
        isFailed.value = true
        errorMessage.value = 'Failed to verify top-up status'
        stopPolling()
        onError?.(errorMessage.value)
        return
      }

      timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }
  }

  function startPolling(billingOpId: string) {
    stopPolling()
    resetState()
    isPending.value = true
    currentOpId = billingOpId
    currentAttempt = 0
    void poll()
  }

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    isPending,
    isSuccess,
    isFailed,
    errorMessage,
    startPolling,
    stopPolling
  }
}
