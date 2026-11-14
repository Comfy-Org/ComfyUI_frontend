import { describe, expect, it, vi } from 'vitest'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import {
  CREDIT_USAGE_SUMMARY_FLAG,
  useCreditUsageSummary
} from './creditUsageSummary'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/utils/devFeatureFlagOverride'))
vi.mock(import('@/utils/sessionFeatureFlagOverride'))

describe('useCreditUsageSummary', () => {
  it.for([['control', false] as const, ['treatment', true] as const])(
    'attributes the %s arm after a charged reply renders',
    ([arm, shown]) => {
      useRemoteConfigStore().acceptConfig(
        { [CREDIT_USAGE_SUMMARY_FLAG]: arm },
        true
      )
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

    const malformedConfig: Record<string, unknown> = {
      [CREDIT_USAGE_SUMMARY_FLAG]: 'unexpected'
    }
    useRemoteConfigStore().acceptConfig(malformedConfig, true)
    experiment.expose()
    expect(useTelemetry()?.trackAgentCreditUsageExposure).not.toHaveBeenCalled()

    vi.mocked(getDevOverride).mockReturnValue('treatment')
    const qaExperiment = useCreditUsageSummary()
    qaExperiment.expose()
    expect(qaExperiment.showSummary.value).toBe(true)
    expect(useTelemetry()?.trackAgentCreditUsageExposure).not.toHaveBeenCalled()
  })

  it('permits one new exposure after the panel reopens', () => {
    useRemoteConfigStore().acceptConfig(
      { [CREDIT_USAGE_SUMMARY_FLAG]: 'treatment' },
      true
    )
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
