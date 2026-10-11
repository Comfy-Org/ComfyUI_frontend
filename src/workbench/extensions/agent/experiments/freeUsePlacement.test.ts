import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import {
  FREE_USE_PLACEMENT_FLAG,
  useFreeUsePlacement
} from './freeUsePlacement'

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

  it('reports a served control arm, which is an arm like any other', () => {
    remoteConfig.value = { 'agent-free-use-message-placement': 'control' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).toHaveBeenCalledWith({
      placement: 'control',
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: 'control'
    })
  })

  // `control` is one of the five arms, so reporting the not-enrolled fallback
  // as `control` would file non-enrolled clients into the control cohort and
  // overstate the experiment's denominator.
  it('renders control but reports no exposure when the flag is absent', () => {
    remoteConfig.value = {}
    authenticatedRemoteConfigState.value = 'authenticated'
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('renders control but reports no exposure for an unknown flag value', () => {
    const config: RemoteConfig = {}
    Object.defineProperty(config, FREE_USE_PLACEMENT_FLAG, {
      enumerable: true,
      value: 'unknown'
    })
    remoteConfig.value = config
    authenticatedRemoteConfigState.value = 'authenticated'
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('prefers session and dev overrides for QA', () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    vi.mocked(getDevOverride).mockReturnValue('near-composer')
    vi.mocked(getSessionOverride).mockReturnValue('inside-input')

    const { variant, attributeExperiment } = useFreeUsePlacement()

    expect(variant.value).toBe('inside-input')
    expect(attributeExperiment).toBe(false)
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  // `/features` can stay pending or fail outright. Waiting on it would leave a
  // reviewer in `control` with no sign the override was read at all.
  it('applies a QA override before authenticated config loads', () => {
    vi.mocked(getSessionOverride).mockReturnValue('top-banner')

    const { variant, attributeExperiment } = useFreeUsePlacement()

    expect(variant.value).toBe('top-banner')
    expect(attributeExperiment).toBe(false)
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('ignores an unrecognised QA override rather than rendering it', () => {
    vi.mocked(getDevOverride).mockReturnValue('sidebar')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('attributes an unoverridden assignment to the experiment', async () => {
    const { attributeExperiment } = useFreeUsePlacement()

    expect(attributeExperiment).toBe(true)
    remoteConfig.value = {
      'agent-free-use-message-placement': 'near-composer'
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfigRevision.value++
    await vi.waitFor(() =>
      expect(useTelemetry()?.trackAgentFreeUseExposure).toHaveBeenCalled()
    )
  })
})
