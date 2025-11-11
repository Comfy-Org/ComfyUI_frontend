import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionCancellationWatcher } from '@/platform/cloud/subscription/composables/useSubscriptionCancellationWatcher'

describe('useSubscriptionCancellationWatcher', () => {
  const trackMonthlySubscriptionCancelled = vi.fn()
  const telemetryMock: Pick<
    import('@/platform/telemetry/types').TelemetryProvider,
    'trackMonthlySubscriptionCancelled'
  > = {
    trackMonthlySubscriptionCancelled
  }

  const baseStatus: CloudSubscriptionStatusResponse = {
    is_active: true,
    subscription_id: 'sub_123',
    renewal_date: '2025-11-16'
  }

  const subscriptionStatus = ref<CloudSubscriptionStatusResponse | null>(
    baseStatus
  )
  const isActive = ref(true)
  const isActiveSubscription = computed(() => isActive.value)

  const shouldWatchCancellation = () => true

  beforeEach(() => {
    vi.useFakeTimers()
    trackMonthlySubscriptionCancelled.mockReset()
    subscriptionStatus.value = { ...baseStatus }
    isActive.value = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls with exponential backoff and fires telemetry once cancellation detected', async () => {
    const fetchStatus = vi.fn(async () => {
      if (fetchStatus.mock.calls.length === 2) {
        isActive.value = false
        subscriptionStatus.value = {
          is_active: false,
          subscription_id: 'sub_cancelled',
          renewal_date: '2025-11-16',
          end_date: '2025-12-01'
        }
      }
    })

    const { startCancellationWatcher } = useSubscriptionCancellationWatcher({
      fetchStatus,
      isActiveSubscription,
      subscriptionStatus,
      telemetry: telemetryMock,
      shouldWatchCancellation
    })

    startCancellationWatcher()

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15000)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    expect(
      telemetryMock.trackMonthlySubscriptionCancelled
    ).toHaveBeenCalledTimes(1)
  })

  it('triggers a check immediately when window regains focus', async () => {
    const fetchStatus = vi.fn(async () => {
      isActive.value = false
      subscriptionStatus.value = {
        ...baseStatus,
        is_active: false,
        end_date: '2025-12-01'
      }
    })

    const { startCancellationWatcher } = useSubscriptionCancellationWatcher({
      fetchStatus,
      isActiveSubscription,
      subscriptionStatus,
      telemetry: telemetryMock,
      shouldWatchCancellation
    })

    startCancellationWatcher()

    window.dispatchEvent(new Event('focus'))
    await Promise.resolve()

    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(
      telemetryMock.trackMonthlySubscriptionCancelled
    ).toHaveBeenCalledTimes(1)
  })
})
