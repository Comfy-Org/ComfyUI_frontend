import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@comfyorg/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  CREDIT_USAGE_SUMMARY_FLAG,
  useCreditUsageSummary
} from './creditUsageSummary'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

describe('useCreditUsageSummary', () => {
  beforeEach(() => {
    authenticatedRemoteConfigState.value = 'unloaded'
    remoteConfig.value = {}
  })

  it.for([['control', false] as const, ['treatment', true] as const])(
    'attributes the %s arm after a charged reply renders',
    ([arm, shown]) => {
      remoteConfig.value = { [CREDIT_USAGE_SUMMARY_FLAG]: arm }
      authenticatedRemoteConfigState.value = 'authenticated'
      const experiment = useCreditUsageSummary()

      expect(experiment.showSummary.value).toBe(shown)
      experiment.expose()
      experiment.expose()

      expect(
        useTelemetry()?.trackAgentCreditUsageExposure
      ).toHaveBeenCalledOnce()
      expect(
        useTelemetry()?.trackAgentCreditUsageExposure
      ).toHaveBeenCalledWith({
        variant: arm,
        [`$feature/${CREDIT_USAGE_SUMMARY_FLAG}`]: arm
      })
    }
  )

  it('does not attribute missing, malformed, pre-auth, or QA assignments', () => {
    const experiment = useCreditUsageSummary()
    experiment.expose()
    expect(useTelemetry()?.trackAgentCreditUsageExposure).not.toHaveBeenCalled()

    authenticatedRemoteConfigState.value = 'authenticated'
    ;(remoteConfig.value as Record<string, unknown>)[
      CREDIT_USAGE_SUMMARY_FLAG
    ] = 'unexpected'
    experiment.expose()
    expect(useTelemetry()?.trackAgentCreditUsageExposure).not.toHaveBeenCalled()

    vi.mocked(getDevOverride).mockReturnValue('treatment')
    const qaExperiment = useCreditUsageSummary()
    qaExperiment.expose()
    expect(qaExperiment.showSummary.value).toBe(true)
    expect(useTelemetry()?.trackAgentCreditUsageExposure).not.toHaveBeenCalled()
  })

  it('permits one new exposure after the panel reopens', () => {
    remoteConfig.value = { [CREDIT_USAGE_SUMMARY_FLAG]: 'treatment' }
    authenticatedRemoteConfigState.value = 'authenticated'
    const panelStore = useAgentPanelStore()
    const experiment = useCreditUsageSummary()
    experiment.expose()

    panelStore.reportedCreditUsageExposure = false
    experiment.expose()

    expect(useTelemetry()?.trackAgentCreditUsageExposure).toHaveBeenCalledTimes(
      2
    )
  })
})
