import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useFreeUsePlacement } from './freeUsePlacement'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

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
    expect(useTelemetry()?.trackAgentFreeUseExposure).toHaveBeenCalledWith({
      placement: 'above-input',
      '$feature/agent-free-use-message-placement': 'above-input'
    })
  })

  it.for([undefined, 'unknown'])('keeps control for %s', async (value) => {
    remoteConfig.value = {
      // Exercise malformed remote input even though the generated config type
      // correctly narrows this flag to its known variants.
      'agent-free-use-message-placement': value as never
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).toHaveBeenCalledWith({
      placement: 'control',
      '$feature/agent-free-use-message-placement': 'control'
    })
  })

  it('prefers session and dev overrides for QA', () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    vi.mocked(getDevOverride).mockReturnValue('near-composer')
    vi.mocked(getSessionOverride).mockReturnValue('inside-input')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('inside-input')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })
})
