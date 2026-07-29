import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { setTelemetryRegistry } from '@/platform/telemetry'
import type { TelemetryProvider } from '@/platform/telemetry/types'

import { useFeatureGate } from './useFeatureGate'

describe('useFeatureGate', () => {
  beforeEach(() => {
    remoteConfig.value = {}
    remoteConfigState.value = 'unloaded'
    sessionStorage.clear()
    setTelemetryRegistry(null)
  })

  it('stays off until authenticated config resolves the flag on', () => {
    remoteConfig.value = {
      release_flags: { might_be_risky_feature_foo: true }
    }
    remoteConfigState.value = 'anonymous'

    const { value } = useFeatureGate('might_be_risky_feature_foo')

    expect(value.value).toBe(false)

    remoteConfigState.value = 'authenticated'

    expect(value.value).toBe(true)
  })

  it('records each resolved key and value once per session', () => {
    const trackFeatureFlagExposure = vi.fn()
    const provider: TelemetryProvider = { trackFeatureFlagExposure }
    const registry = new TelemetryRegistry()
    registry.registerProvider(provider)
    setTelemetryRegistry(registry)
    remoteConfig.value = {
      release_flags: { might_be_risky_feature_foo: true }
    }
    remoteConfigState.value = 'authenticated'

    const { recordExposure } = useFeatureGate('might_be_risky_feature_foo')

    recordExposure()
    recordExposure()

    expect(trackFeatureFlagExposure).toHaveBeenCalledExactlyOnceWith(
      'might_be_risky_feature_foo',
      true
    )
  })
})
