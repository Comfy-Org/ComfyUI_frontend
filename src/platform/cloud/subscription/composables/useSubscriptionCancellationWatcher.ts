import { onScopeDispose, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { defaultWindow, useEventListener, useTimeoutFn } from '@vueuse/core'

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
  const nextDelay = ref(CANCELLATION_BASE_DELAY_MS)

  const { start: startTimer, stop: stopTimer } = useTimeoutFn(
    () => {
      void checkForCancellation()
    },
    nextDelay,
    { immediate: false }
  )

  const stopCancellationWatcher = () => {
    watcherActive.value = false
    stopTimer()
    cancellationAttempts.value = 0
    cancellationCheckInFlight.value = false
  }

  const scheduleNextCancellationCheck = () => {
    if (!watcherActive.value) return

    if (cancellationAttempts.value >= MAX_CANCELLATION_ATTEMPTS) {
      stopCancellationWatcher()
      return
    }

    nextDelay.value =
      CANCELLATION_BASE_DELAY_MS * 3 ** cancellationAttempts.value
    cancellationAttempts.value += 1
    startTimer()
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
    if (!shouldWatchCancellation() || !subscriptionStatus.value?.is_active) {
      return
    }

    stopCancellationWatcher()
    watcherActive.value = true
    cancellationTracked.value = false
    cancellationAttempts.value = 0
    scheduleNextCancellationCheck()
  }

  const stopFocusListener = useEventListener(defaultWindow, 'focus', () => {
    if (!watcherActive.value) return
    void checkForCancellation(true)
  })

  onScopeDispose(() => {
    stopFocusListener()
    stopCancellationWatcher()
  })

  return {
    startCancellationWatcher,
    stopCancellationWatcher
  }
}
