import { computed } from 'vue'

import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@comfyorg/telemetry'
import type { AgentCreditUsageVariant } from '@comfyorg/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export const CREDIT_USAGE_SUMMARY_FLAG = 'agent-credit-usage-summary'
const assignmentSchema =
  zGetFeaturesResponse.shape[CREDIT_USAGE_SUMMARY_FLAG].catch('control')

function resolveAssignment(): {
  assignment: AgentCreditUsageVariant
  hasQaOverride: boolean
  hasServedAssignment: boolean
} {
  const sessionOverride = getSessionOverride<unknown>(CREDIT_USAGE_SUMMARY_FLAG)
  const override =
    sessionOverride !== undefined
      ? sessionOverride
      : getDevOverride<unknown>(CREDIT_USAGE_SUMMARY_FLAG)
  const candidate =
    override !== undefined
      ? override
      : remoteConfig.value[CREDIT_USAGE_SUMMARY_FLAG]
  return {
    assignment: assignmentSchema.parse(candidate),
    hasQaOverride: override !== undefined,
    hasServedAssignment: candidate === 'control' || candidate === 'treatment'
  }
}

export function useCreditUsageSummary() {
  const panelStore = useAgentPanelStore()
  const assignment = computed(() => {
    const resolved = resolveAssignment()
    return isAuthenticatedConfigLoaded.value || resolved.hasQaOverride
      ? resolved.assignment
      : 'control'
  })
  const attributeExperiment = computed(() => {
    const resolved = resolveAssignment()
    return (
      isAuthenticatedConfigLoaded.value &&
      !resolved.hasQaOverride &&
      resolved.hasServedAssignment
    )
  })

  const expose = () => {
    if (!attributeExperiment.value || panelStore.reportedCreditUsageExposure)
      return
    panelStore.reportedCreditUsageExposure = true
    useTelemetry()?.trackAgentCreditUsageExposure({
      variant: assignment.value,
      [`$feature/${CREDIT_USAGE_SUMMARY_FLAG}`]: assignment.value
    })
  }

  return {
    assignment,
    showSummary: computed(() => assignment.value === 'treatment'),
    expose
  }
}
