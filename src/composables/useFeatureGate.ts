import { computed } from 'vue'

import {
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

const fallbackRecordedExposures = new Set<string>()

function hasRecordedExposure(key: string): boolean {
  try {
    return (
      sessionStorage.getItem(key) !== null || fallbackRecordedExposures.has(key)
    )
  } catch {
    return fallbackRecordedExposures.has(key)
  }
}

function markExposureRecorded(key: string): void {
  fallbackRecordedExposures.add(key)

  try {
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
}

export function useFeatureGate(key: string) {
  const value = computed(() => {
    const override = getDevOverride<boolean>(key)
    if (typeof override === 'boolean') return override
    if (remoteConfigState.value !== 'authenticated') return false

    const resolvedValue = remoteConfig.value.release_flags?.[key]
    return typeof resolvedValue === 'boolean' ? resolvedValue : false
  })

  function recordExposure(): void {
    if (
      remoteConfigState.value !== 'authenticated' &&
      remoteConfigState.value !== 'error'
    ) {
      return
    }

    const exposureKey = `feature-flag-exposure:${key}:${value.value}`
    if (hasRecordedExposure(exposureKey)) return

    const telemetry = useTelemetry()
    if (!telemetry) return

    telemetry.trackFeatureFlagExposure(key, value.value)
    markExposureRecorded(exposureKey)
  }

  return {
    value,
    recordExposure
  }
}
