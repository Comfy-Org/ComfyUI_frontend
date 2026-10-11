import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useAgentPanelStore } from '../stores/agent/agentPanelStore'
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
  })

  it('uses a known authenticated assignment and attributes it', async () => {
    const { variant, reportNotice } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    remoteConfig.value = {
      'agent-free-use-message-placement': 'above-input'
    }
    authenticatedRemoteConfigState.value = 'authenticated'
    await vi.waitFor(() => expect(variant.value).toBe('above-input'))
    expect(useTelemetry()?.trackAgentFreeUseExposure).toHaveBeenCalledWith({
      placement: 'above-input',
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: 'above-input'
    })

    reportNotice({ action: 'shown', placement: 'above-input' })
    expect(useTelemetry()?.trackAgentFreeUseNotice).toHaveBeenCalledWith({
      action: 'shown',
      placement: 'above-input'
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

  it.for([
    { label: 'absent', served: undefined },
    { label: 'unknown', served: 'sidebar' }
  ])(
    'renders control but reports no exposure when the flag is $label',
    ({ served }) => {
      const wireConfig: Record<string, unknown> = {
        [FREE_USE_PLACEMENT_FLAG]: served
      }
      remoteConfig.value = wireConfig
      authenticatedRemoteConfigState.value = 'authenticated'
      const { variant } = useFreeUsePlacement()

      expect(variant.value).toBe('control')
      expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    }
  )

  it('prefers session and dev overrides for QA', () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    vi.mocked(getDevOverride).mockReturnValue('near-composer')
    vi.mocked(getSessionOverride).mockReturnValue('inside-input')

    const { variant, reportNotice } = useFreeUsePlacement()
    reportNotice({ action: 'shown', placement: 'inside-input' })

    expect(variant.value).toBe('inside-input')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackAgentFreeUseNotice).not.toHaveBeenCalled()
  })

  it('applies a QA override before authenticated config loads', () => {
    vi.mocked(getSessionOverride).mockReturnValue('top-banner')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('top-banner')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('ignores an unrecognised QA override rather than rendering it', () => {
    vi.mocked(console.warn).mockImplementation(() => {})
    vi.mocked(getDevOverride).mockReturnValue('sidebar')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('sidebar')
    )
  })

  it('reports exposure and the impression once per panel open', () => {
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const telemetry = useTelemetry()

    useFreeUsePlacement().reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })
    useFreeUsePlacement().reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })

    expect(telemetry?.trackAgentFreeUseExposure).toHaveBeenCalledTimes(1)
    expect(telemetry?.trackAgentFreeUseNotice).toHaveBeenCalledTimes(1)

    useAgentPanelStore().isOpen = false
    useAgentPanelStore().open()
    useFreeUsePlacement().reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })

    expect(telemetry?.trackAgentFreeUseExposure).toHaveBeenCalledTimes(2)
    expect(telemetry?.trackAgentFreeUseNotice).toHaveBeenCalledTimes(2)
  })

  it('does not deduplicate interactions other than the impression', () => {
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const { reportNotice } = useFreeUsePlacement()

    reportNotice({ action: 'learn_more_clicked', placement: 'top-banner' })
    reportNotice({ action: 'learn_more_clicked', placement: 'top-banner' })

    expect(useTelemetry()?.trackAgentFreeUseNotice).toHaveBeenCalledTimes(2)
  })
})
