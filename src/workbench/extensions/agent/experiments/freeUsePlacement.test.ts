import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  FREE_USE_PLACEMENT_FLAG,
  useFreeUsePlacement as useFreeUsePlacementImpl
} from './freeUsePlacement'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

let placementScope: EffectScope

function useFreeUsePlacement() {
  let placement: ReturnType<typeof useFreeUsePlacementImpl> | undefined
  placementScope.run(() => {
    placement = useFreeUsePlacementImpl()
  })
  return placement!
}

describe('useFreeUsePlacement', () => {
  beforeEach(() => {
    placementScope = effectScope()
    authenticatedRemoteConfigState.value = 'unloaded'
    remoteConfig.value = {}
  })

  afterEach(() => placementScope.stop())

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

  it('treats an explicit null session override as a QA override', () => {
    vi.mocked(getSessionOverride).mockReturnValue(null)
    vi.mocked(getDevOverride).mockReturnValue('top-banner')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('ignores an unrecognised QA override rather than rendering it', () => {
    vi.mocked(getDevOverride).mockReturnValue('sidebar')

    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
  })

  it('reports exposure and the impression once per panel open', async () => {
    remoteConfig.value = { 'agent-free-use-message-placement': 'top-banner' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const telemetry = useTelemetry()!
    vi.mocked(telemetry.trackAgentFreeUseExposure).mockClear()
    vi.mocked(telemetry.trackAgentFreeUseNotice).mockClear()

    const placement = useFreeUsePlacement()
    placement.reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })
    placement.reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })

    expect(telemetry.trackAgentFreeUseExposure).toHaveBeenCalledTimes(1)
    expect(telemetry.trackAgentFreeUseNotice).toHaveBeenCalledTimes(1)

    useAgentPanelStore().isOpen = false
    await nextTick()
    useAgentPanelStore().open()
    await nextTick()
    placement.reportNotice({
      action: 'shown',
      placement: 'top-banner'
    })

    expect(telemetry.trackAgentFreeUseExposure).toHaveBeenCalledTimes(2)
    expect(telemetry.trackAgentFreeUseNotice).toHaveBeenCalledTimes(2)
  })

  it('attributes a valid arm after a later authenticated config refresh', async () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    const malformedConfig: Record<string, unknown> = {
      [FREE_USE_PLACEMENT_FLAG]: 'unknown'
    }
    remoteConfig.value = malformedConfig
    const { variant } = useFreeUsePlacement()
    const telemetry = useTelemetry()!
    vi.mocked(telemetry.trackAgentFreeUseExposure).mockClear()

    expect(variant.value).toBe('control')
    expect(telemetry.trackAgentFreeUseExposure).not.toHaveBeenCalled()

    remoteConfig.value = { [FREE_USE_PLACEMENT_FLAG]: 'inside-input' }

    await vi.waitFor(() => expect(variant.value).toBe('inside-input'))
    expect(telemetry.trackAgentFreeUseExposure).toHaveBeenCalledTimes(1)
  })

  it('returns to control when a later config refresh is invalid', async () => {
    authenticatedRemoteConfigState.value = 'authenticated'
    remoteConfig.value = { [FREE_USE_PLACEMENT_FLAG]: 'inside-input' }
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('inside-input')

    const malformedConfig: Record<string, unknown> = {
      [FREE_USE_PLACEMENT_FLAG]: 'unknown'
    }
    remoteConfig.value = malformedConfig

    await vi.waitFor(() => expect(variant.value).toBe('control'))
  })

  it('re-attributes a mounted panel when it reopens', async () => {
    remoteConfig.value = { [FREE_USE_PLACEMENT_FLAG]: 'top-banner' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const panelStore = useAgentPanelStore()
    useFreeUsePlacement()
    const telemetry = useTelemetry()!
    vi.mocked(telemetry.trackAgentFreeUseExposure).mockClear()

    panelStore.close('close_button')
    await nextTick()
    panelStore.open()
    await nextTick()

    expect(telemetry.trackAgentFreeUseExposure).toHaveBeenCalledTimes(1)
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
