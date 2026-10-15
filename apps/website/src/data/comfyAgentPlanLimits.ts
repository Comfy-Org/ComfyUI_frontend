import type { PlanFeatureGroup } from '@/data/pricingPlans'
import type { TranslationKey } from '@/i18n/translations'

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

export function comfyAgentFeatureGroups(planId: string): PlanFeatureGroup[] {
  const limits = comfyAgentPlanLimits.find((plan) => plan.id === planId)
  if (!limits) return []
  return [
    {
      titleKey: 'pricing.agent.cardTitle',
      features: [
        {
          text: 'pricing.agent.cardFeature.sessionsPerWorkspace',
          params: { count: limits.concurrentRequestsPerWorkspace }
        }
      ]
    }
  ]
}
