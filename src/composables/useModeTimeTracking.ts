import { tryOnScopeDispose, useEventListener } from '@vueuse/core'
import { watch } from 'vue'

import { useTelemetry } from '@/platform/telemetry'

import type { AppMode } from './useAppMode'
import { useAppMode } from './useAppMode'

/**
 * Tracks active (tab-visible) time spent in each {@link AppMode} and emits an
 * `app:mode_time_spent` event whenever the user leaves a mode, backgrounds the
 * tab, or tears down. Hidden-tab time is excluded, and flushing on tab-hide
 * means a closing tab is still captured (`visibilitychange` fires before
 * unload). Summing `duration_seconds` grouped by `mode` yields time per mode.
 *
 * Side-effecting composable: call once from a long-lived scope (GraphView).
 */
export function useModeTimeTracking() {
  const dispatcher = useTelemetry()
  if (!dispatcher) return
  const trackModeTimeSpent = dispatcher.trackModeTimeSpent.bind(dispatcher)

  const { mode } = useAppMode()

  const isVisible = () => document.visibilityState === 'visible'

  let trackedMode: AppMode = mode.value
  let accumulatedMs = 0
  let segmentStart: number | null = isVisible() ? Date.now() : null

  function closeSegment() {
    if (segmentStart !== null) {
      accumulatedMs += Date.now() - segmentStart
      segmentStart = null
    }
  }

  function flush() {
    closeSegment()
    const durationSeconds = Math.round(accumulatedMs / 1000)
    accumulatedMs = 0
    if (durationSeconds >= 1) {
      trackModeTimeSpent({
        mode: trackedMode,
        duration_seconds: durationSeconds
      })
    }
  }

  watch(mode, (newMode) => {
    flush()
    trackedMode = newMode
    segmentStart = isVisible() ? Date.now() : null
  })

  useEventListener(document, 'visibilitychange', () => {
    if (isVisible()) {
      segmentStart = Date.now()
    } else {
      flush()
    }
  })

  tryOnScopeDispose(flush)
}
