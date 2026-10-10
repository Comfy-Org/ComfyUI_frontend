import type { PlanFeatureGroup } from '@/data/pricingPlans'
import type { TranslationKey } from '@/i18n/translations'

export const COMFY_AGENT_MONTHLY_ALLOWANCE_USD = '$0.70'

export interface ComfyAgentPlanLimits {
  id: string
  labelKey: TranslationKey
  concurrentTasksPerMember: number
  concurrentRequestsPerWorkspace: number
}

export const comfyAgentPlanLimits: readonly ComfyAgentPlanLimits[] = [
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    concurrentTasksPerMember: 4,
    concurrentRequestsPerWorkspace: 4
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    concurrentTasksPerMember: 4,
    concurrentRequestsPerWorkspace: 6
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    concurrentTasksPerMember: 4,
    concurrentRequestsPerWorkspace: 8
  },
  {
    id: 'team',
    labelKey: 'pricing.plan.team.label',
    concurrentTasksPerMember: 4,
    concurrentRequestsPerWorkspace: 16
  }
]

export function comfyAgentFeatureGroup(planId: string): PlanFeatureGroup {
  const allowance = {
    text: 'pricing.agent.cardFeature.allowance',
    params: { allowance: COMFY_AGENT_MONTHLY_ALLOWANCE_USD }
  } as const
  const limits = comfyAgentPlanLimits.find((plan) => plan.id === planId)
  return {
    titleKey: 'pricing.agent.cardTitle',
    features: limits
      ? [
          allowance,
          {
            text: 'pricing.agent.cardFeature.tasksPerMember',
            params: { count: limits.concurrentTasksPerMember }
          },
          {
            text: 'pricing.agent.cardFeature.requestsPerWorkspace',
            params: { count: limits.concurrentRequestsPerWorkspace }
          }
        ]
      : [allowance]
  }
}
