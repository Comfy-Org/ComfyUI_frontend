import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'

import { useFreeUsePlacement } from './freeUsePlacement'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/platform/telemetry'))

describe('useFreeUsePlacement', () => {
  beforeEach(() => {
    authenticatedRemoteConfigState.value = 'unloaded'
    remoteConfig.value = {}
    remoteConfigRevision.value = 0
  })

  it('uses a known authenticated assignment', async () => {
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    remoteConfig.value = {
      'agent-free-use-message-placement': 'above-input'
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfigRevision.value++
    await vi.waitFor(() => expect(variant.value).toBe('above-input'))
    expect(variant.value).toBe('above-input')
    expect(useTelemetry()?.trackFeatureFlagEvaluation).toHaveBeenCalledWith(
      'agent-free-use-message-placement',
      'above-input'
    )
  })

  it.for([undefined, 'unknown'])('keeps control for %s', async (value) => {
    remoteConfig.value = {
      'agent-free-use-message-placement': value
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackFeatureFlagEvaluation).toHaveBeenCalledWith(
      'agent-free-use-message-placement',
      'control'
    )
  })
})
