import { computed } from 'vue'

import {
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

export function useFeatureGate(key: string) {
  const value = computed(() => {
    const override = getDevOverride<boolean>(key)
    if (typeof override === 'boolean') return override
    if (remoteConfigState.value !== 'authenticated') return false

    const resolvedValue = remoteConfig.value.release_flags?.[key]
    return typeof resolvedValue === 'boolean' ? resolvedValue : false
  })

  function recordExposure(): void {
    if (remoteConfigState.value !== 'authenticated') return

    const exposureKey = `feature-flag-exposure:${key}:${value.value}`
    if (sessionStorage.getItem(exposureKey) !== null) return

    const telemetry = useTelemetry()
    if (!telemetry) return

    telemetry.trackFeatureFlagExposure(key, value.value)
    sessionStorage.setItem(exposureKey, '1')
  }

  return {
    value,
    recordExposure
  }
}
