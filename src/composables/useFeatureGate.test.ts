import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    localStorage.clear()
    sessionStorage.clear()
    setTelemetryRegistry(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('defaults missing flags to off', () => {
    remoteConfigState.value = 'authenticated'

    const { value } = useFeatureGate('missing_flag')

    expect(value.value).toBe(false)
  })

  it('gives a boolean development override precedence', () => {
    localStorage.setItem('ff:might_be_risky_feature_foo', 'false')
    remoteConfig.value = {
      release_flags: { might_be_risky_feature_foo: true }
    }
    remoteConfigState.value = 'authenticated'

    const { value } = useFeatureGate('might_be_risky_feature_foo')

    expect(value.value).toBe(false)
  })

  it('does not record exposure before authenticated config resolves', () => {
    const trackFeatureFlagExposure = vi.fn()
    const registry = new TelemetryRegistry()
    registry.registerProvider({ trackFeatureFlagExposure })
    setTelemetryRegistry(registry)

    const { recordExposure } = useFeatureGate('might_be_risky_feature_foo')

    recordExposure()

    expect(trackFeatureFlagExposure).not.toHaveBeenCalled()
  })

  it('does not throw when telemetry is unavailable', () => {
    remoteConfigState.value = 'authenticated'

    const { recordExposure } = useFeatureGate('might_be_risky_feature_foo')

    expect(() => recordExposure()).not.toThrow()
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

  it.for([
    {
      name: 'registered OFF',
      key: 'registered_off',
      state: 'authenticated' as const,
      releaseFlags: { registered_off: false } as Record<string, boolean>,
      expected: false
    },
    {
      name: 'registered ON',
      key: 'registered_on',
      state: 'authenticated' as const,
      releaseFlags: { registered_on: true } as Record<string, boolean>,
      expected: true
    },
    {
      name: 'unregistered',
      key: 'unregistered',
      state: 'authenticated' as const,
      releaseFlags: {} as Record<string, boolean>,
      expected: false
    },
    {
      name: 'evaluation failed',
      key: 'evaluation_failed',
      state: 'error' as const,
      releaseFlags: {} as Record<string, boolean>,
      expected: false
    }
  ])(
    'fails closed and records the resolved decision for $name',
    ({ key, state, releaseFlags, expected }) => {
      const trackFeatureFlagExposure = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackFeatureFlagExposure })
      setTelemetryRegistry(registry)
      remoteConfig.value = { release_flags: releaseFlags }
      remoteConfigState.value = state

      const { value, recordExposure } = useFeatureGate(key)
      recordExposure()
      recordExposure()

      expect(value.value).toBe(expected)
      expect(trackFeatureFlagExposure).toHaveBeenCalledExactlyOnceWith(
        key,
        expected
      )
    }
  )

  it('deduplicates in memory when session storage writes are unavailable', () => {
    const trackFeatureFlagExposure = vi.fn()
    const registry = new TelemetryRegistry()
    registry.registerProvider({ trackFeatureFlagExposure })
    setTelemetryRegistry(registry)
    remoteConfigState.value = 'authenticated'
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    const { recordExposure } = useFeatureGate('storage_unavailable_flag')

    expect(() => {
      recordExposure()
      recordExposure()
    }).not.toThrow()
    expect(trackFeatureFlagExposure).toHaveBeenCalledExactlyOnceWith(
      'storage_unavailable_flag',
      false
    )
  })

  it('deduplicates in memory when session storage reads are unavailable', () => {
    const trackFeatureFlagExposure = vi.fn()
    const registry = new TelemetryRegistry()
    registry.registerProvider({ trackFeatureFlagExposure })
    setTelemetryRegistry(registry)
    remoteConfigState.value = 'authenticated'
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    const { recordExposure } = useFeatureGate('storage_read_unavailable_flag')

    expect(() => {
      recordExposure()
      recordExposure()
    }).not.toThrow()
    expect(trackFeatureFlagExposure).toHaveBeenCalledExactlyOnceWith(
      'storage_read_unavailable_flag',
      false
    )
  })
})
