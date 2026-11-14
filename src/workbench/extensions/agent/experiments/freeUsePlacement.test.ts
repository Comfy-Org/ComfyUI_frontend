import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  FREE_USE_PLACEMENT_FLAG,
  LOCAL_FREE_USE_PLACEMENT,
  useFreeUsePlacement as useFreeUsePlacementImpl
} from './freeUsePlacement'

const distribution = { isCloud: true }

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

let placementScope: EffectScope

function useFreeUsePlacement() {
  let placement: ReturnType<typeof useFreeUsePlacementImpl> | undefined
  placementScope.run(() => {
    placement = useFreeUsePlacementImpl(distribution.isCloud)
  })
  return placement!
}

describe('useFreeUsePlacement', () => {
  beforeEach(() => {
    placementScope = effectScope()
    distribution.isCloud = true
  })

  afterEach(() => placementScope.stop())

  it('uses a known authenticated assignment and attributes it', async () => {
    const { variant, reportNotice } = useFreeUsePlacement()

    expect(variant.value).toBe('control')
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'above-input' },
      true
    )
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

  it('reports Local notice telemetry without Cloud experiment exposure', () => {
    distribution.isCloud = false
    const telemetry = useTelemetry()!
    const { variant, reportNotice } = useFreeUsePlacement()

    expect(variant.value).toBe(LOCAL_FREE_USE_PLACEMENT)
    expect(telemetry.trackAgentFreeUseExposure).not.toHaveBeenCalled()

    reportNotice({ action: 'shown', placement: LOCAL_FREE_USE_PLACEMENT })
    reportNotice({
      action: 'learn_more_clicked',
      placement: LOCAL_FREE_USE_PLACEMENT
    })
    expect(telemetry.trackAgentFreeUseNotice).toHaveBeenNthCalledWith(1, {
      action: 'shown',
      placement: LOCAL_FREE_USE_PLACEMENT,
      deployment: 'local'
    })
    expect(telemetry.trackAgentFreeUseNotice).toHaveBeenNthCalledWith(2, {
      action: 'learn_more_clicked',
      placement: LOCAL_FREE_USE_PLACEMENT,
      deployment: 'local'
    })
  })

  it('reports a served control arm, which is an arm like any other', () => {
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'control' },
      true
    )
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
      useRemoteConfigStore().acceptConfig(wireConfig, true)
      const { variant } = useFreeUsePlacement()

      expect(variant.value).toBe('control')
      expect(useTelemetry()?.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    }
  )

  it('prefers session and dev overrides for QA', () => {
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'top-banner' },
      true
    )
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
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'top-banner' },
      true
    )
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
    const malformedConfig: Record<string, unknown> = {
      [FREE_USE_PLACEMENT_FLAG]: 'unknown'
    }
    useRemoteConfigStore().acceptConfig(malformedConfig, true)
    const { variant } = useFreeUsePlacement()
    const telemetry = useTelemetry()!
    vi.mocked(telemetry.trackAgentFreeUseExposure).mockClear()

    expect(variant.value).toBe('control')
    expect(telemetry.trackAgentFreeUseExposure).not.toHaveBeenCalled()

    useRemoteConfigStore().acceptConfig(
      { [FREE_USE_PLACEMENT_FLAG]: 'inside-input' },
      true
    )

    await vi.waitFor(() => expect(variant.value).toBe('inside-input'))
    expect(telemetry.trackAgentFreeUseExposure).toHaveBeenCalledTimes(1)
  })

  it('returns to control when a later config refresh is invalid', async () => {
    useRemoteConfigStore().acceptConfig(
      { [FREE_USE_PLACEMENT_FLAG]: 'inside-input' },
      true
    )
    const { variant } = useFreeUsePlacement()

    expect(variant.value).toBe('inside-input')

    const malformedConfig: Record<string, unknown> = {
      [FREE_USE_PLACEMENT_FLAG]: 'unknown'
    }
    useRemoteConfigStore().acceptConfig(malformedConfig, true)

    await vi.waitFor(() => expect(variant.value).toBe('control'))
  })

  it('re-attributes a mounted panel when it reopens', async () => {
    useRemoteConfigStore().acceptConfig(
      { [FREE_USE_PLACEMENT_FLAG]: 'top-banner' },
      true
    )
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
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'top-banner' },
      true
    )
    const { reportNotice } = useFreeUsePlacement()

    reportNotice({ action: 'learn_more_clicked', placement: 'top-banner' })
    reportNotice({ action: 'learn_more_clicked', placement: 'top-banner' })

    expect(useTelemetry()?.trackAgentFreeUseNotice).toHaveBeenCalledTimes(2)
  })
})
