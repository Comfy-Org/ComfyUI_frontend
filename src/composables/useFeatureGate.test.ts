import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { remoteConfigState } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { setTelemetryRegistry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'

import { useFeatureGate } from './useFeatureGate'

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

const fetchApi = vi.mocked(api.fetchApi)
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function featureFlagResponse(flags: Record<string, boolean>) {
  return new Response(JSON.stringify({ flags }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('useFeatureGate', () => {
  beforeEach(() => {
    fetchApi.mockReset()
    remoteConfigState.value = 'anonymous'
    localStorage.clear()
    sessionStorage.clear()
    setTelemetryRegistry(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('evaluates any PostHog key after authentication', async () => {
    fetchApi.mockResolvedValue(
      featureFlagResponse({ feature_flag_foobar: true })
    )
    const gate = useFeatureGate('feature_flag_foobar')

    expect(gate.value.value).toBe(false)
    expect(gate.state.value).toBe('unloaded')

    remoteConfigState.value = 'authenticated'
    await flushPromises()

    expect(fetchApi).toHaveBeenCalledWith('/feature-flags/evaluate', {
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: expect.any(AbortSignal)
    })
    expect(JSON.parse(fetchApi.mock.calls.at(-1)![1]!.body as string)).toEqual({
      keys: expect.arrayContaining(['feature_flag_foobar'])
    })
    expect(gate.value.value).toBe(true)
    expect(gate.state.value).toBe('resolved')
  })

  it.for([
    {
      name: 'PostHog OFF',
      key: 'registered_off',
      response: featureFlagResponse({ registered_off: false }),
      expected: false,
      expectedState: 'resolved'
    },
    {
      name: 'PostHog ON',
      key: 'registered_on',
      response: featureFlagResponse({ registered_on: true }),
      expected: true,
      expectedState: 'resolved'
    },
    {
      name: 'missing',
      key: 'unregistered',
      response: featureFlagResponse({}),
      expected: false,
      expectedState: 'resolved'
    },
    {
      name: 'evaluation failed',
      key: 'evaluation_failed',
      response: new Error('Cloud unavailable'),
      expected: false,
      expectedState: 'error'
    }
  ])(
    'fails closed and records the resolved decision for $name',
    async ({ key, response, expected, expectedState }) => {
      const trackFeatureFlagExposure = vi.fn()
      const registry = new TelemetryRegistry()
      registry.registerProvider({ trackFeatureFlagExposure })
      setTelemetryRegistry(registry)
      if (response instanceof Error) {
        fetchApi.mockRejectedValue(response)
      } else {
        fetchApi.mockResolvedValue(response)
      }
      const gate = useFeatureGate(key)
      remoteConfigState.value = 'authenticated'
      await flushPromises()
      gate.recordExposure()
      gate.recordExposure()

      expect(gate.value.value).toBe(expected)
      expect(gate.state.value).toBe(expectedState)
      expect(trackFeatureFlagExposure).toHaveBeenCalledExactlyOnceWith(
        key,
        expected
      )
    }
  )

  it('gives a boolean development override precedence', () => {
    localStorage.setItem('ff:local_override', 'true')
    fetchApi.mockResolvedValue(featureFlagResponse({}))
    remoteConfigState.value = 'authenticated'
    fetchApi.mockClear()

    const gate = useFeatureGate('local_override')

    expect(gate.value.value).toBe(true)
    expect(gate.state.value).toBe('resolved')
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('does not record exposure before evaluation resolves', () => {
    const trackFeatureFlagExposure = vi.fn()
    const registry = new TelemetryRegistry()
    registry.registerProvider({ trackFeatureFlagExposure })
    setTelemetryRegistry(registry)
    fetchApi.mockReturnValue(new Promise(() => {}))

    const gate = useFeatureGate('pending_flag')
    remoteConfigState.value = 'authenticated'

    expect(gate.state.value).toBe('loading')
    gate.recordExposure()

    expect(trackFeatureFlagExposure).not.toHaveBeenCalled()
  })
})
