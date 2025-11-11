import { onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

import type { TelemetryProvider } from '@/platform/telemetry/types'

import type { CloudSubscriptionStatusResponse } from './useSubscription'

const MAX_CANCELLATION_ATTEMPTS = 4
const CANCELLATION_BASE_DELAY_MS = 5000

type CancellationWatcherOptions = {
  fetchStatus: () => Promise<CloudSubscriptionStatusResponse | null | void>
  isActiveSubscription: ComputedRef<boolean>
  subscriptionStatus: Ref<CloudSubscriptionStatusResponse | null>
  telemetry: Pick<TelemetryProvider, 'trackMonthlySubscriptionCancelled'> | null
  shouldWatchCancellation: () => boolean
}

export function useSubscriptionCancellationWatcher({
  fetchStatus,
  isActiveSubscription,
  subscriptionStatus,
  telemetry,
  shouldWatchCancellation
}: CancellationWatcherOptions) {
  const watcherActive = ref(false)
  const cancellationAttempts = ref(0)
  const cancellationTracked = ref(false)
  const cancellationCheckInFlight = ref(false)
  const cancellationTimeoutId = ref<number | null>(null)

  const clearScheduledCheck = () => {
    if (cancellationTimeoutId.value !== null) {
      clearTimeout(cancellationTimeoutId.value)
      cancellationTimeoutId.value = null
    }
  }

  const stopCancellationWatcher = () => {
    watcherActive.value = false
    clearScheduledCheck()
    cancellationAttempts.value = 0
    cancellationCheckInFlight.value = false
  }

  const scheduleNextCancellationCheck = () => {
    if (!watcherActive.value || typeof window === 'undefined') return

    if (cancellationAttempts.value >= MAX_CANCELLATION_ATTEMPTS) {
      stopCancellationWatcher()
      return
    }

    const delay = CANCELLATION_BASE_DELAY_MS * 3 ** cancellationAttempts.value
    cancellationAttempts.value += 1
    cancellationTimeoutId.value = window.setTimeout(() => {
      void checkForCancellation()
    }, delay)
  }

  const checkForCancellation = async (triggeredFromFocus = false) => {
    if (!watcherActive.value || cancellationCheckInFlight.value) return

    cancellationCheckInFlight.value = true
    try {
      await fetchStatus()

      if (!isActiveSubscription.value) {
        if (!cancellationTracked.value) {
          cancellationTracked.value = true
          telemetry?.trackMonthlySubscriptionCancelled()
        }
        stopCancellationWatcher()
        return
      }

      if (!triggeredFromFocus) {
        scheduleNextCancellationCheck()
      }
    } catch (error) {
      console.error('[Subscription] Error checking cancellation status:', error)
      scheduleNextCancellationCheck()
    } finally {
      cancellationCheckInFlight.value = false
    }
  }

  const startCancellationWatcher = () => {
    if (
      !shouldWatchCancellation() ||
      !subscriptionStatus.value?.is_active ||
      typeof window === 'undefined'
    ) {
      return
    }

    stopCancellationWatcher()
    watcherActive.value = true
    cancellationTracked.value = false
    cancellationAttempts.value = 0
    scheduleNextCancellationCheck()
  }

  const stopFocusListener =
    typeof window !== 'undefined'
      ? useEventListener(window, 'focus', () => {
          if (!watcherActive.value) return
          void checkForCancellation(true)
        })
      : () => {}

  onScopeDispose(() => {
    stopFocusListener()
    stopCancellationWatcher()
  })

  return {
    startCancellationWatcher,
    stopCancellationWatcher
  }
}
