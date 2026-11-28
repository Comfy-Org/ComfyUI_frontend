import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useTelemetry } from '@comfyorg/telemetry'

import {
  LOCAL_FREE_USE_PLACEMENT,
  useFreeUsePlacement
} from './freeUsePlacement'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@comfyorg/telemetry'))

describe('useFreeUsePlacement', () => {
  beforeEach(() => {
    useRemoteConfigStore().acceptConfig(
      { 'agent-free-use-message-placement': 'near-composer' },
      true
    )
  })

  it('keeps the selected near-composer notice on Cloud after the experiment ends', () => {
    const telemetry = useTelemetry()!
    const { variant, reportNotice } = useFreeUsePlacement(true)

    expect(variant.value).toBe(LOCAL_FREE_USE_PLACEMENT)
    reportNotice({ action: 'shown', placement: 'near-composer' })
    expect(telemetry.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    expect(telemetry.trackAgentFreeUseNotice).toHaveBeenCalledExactlyOnceWith({
      action: 'shown',
      placement: LOCAL_FREE_USE_PLACEMENT,
      deployment: 'cloud'
    })
  })

  it('retains the Local notice and its interaction telemetry', () => {
    const telemetry = useTelemetry()!
    const { variant, reportNotice } = useFreeUsePlacement(false)

    expect(variant.value).toBe(LOCAL_FREE_USE_PLACEMENT)
    reportNotice({ action: 'shown', placement: LOCAL_FREE_USE_PLACEMENT })
    reportNotice({ action: 'shown', placement: LOCAL_FREE_USE_PLACEMENT })
    reportNotice({
      action: 'learn_more_clicked',
      placement: LOCAL_FREE_USE_PLACEMENT
    })

    expect(telemetry.trackAgentFreeUseExposure).not.toHaveBeenCalled()
    expect(vi.mocked(telemetry.trackAgentFreeUseNotice).mock.calls).toEqual([
      [
        {
          action: 'shown',
          placement: LOCAL_FREE_USE_PLACEMENT,
          deployment: 'local'
        }
      ],
      [
        {
          action: 'learn_more_clicked',
          placement: LOCAL_FREE_USE_PLACEMENT,
          deployment: 'local'
        }
      ]
    ])
  })
})
