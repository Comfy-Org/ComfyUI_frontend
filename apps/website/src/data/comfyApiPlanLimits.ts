import type { TranslationKey } from '@/i18n/translations'

export interface ComfyApiPlanLimits {
  id: string
  labelKey: TranslationKey
  totalReleasesLimit: number
  totalDeploymentsLimit: number
  maxWorkerConcurrency: number
}

export const comfyApiPlanLimits: readonly ComfyApiPlanLimits[] = [
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    totalReleasesLimit: 5,
    totalDeploymentsLimit: 2,
    maxWorkerConcurrency: 2
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    totalReleasesLimit: 5,
    totalDeploymentsLimit: 2,
    maxWorkerConcurrency: 2
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    totalReleasesLimit: 10,
    totalDeploymentsLimit: 5,
    maxWorkerConcurrency: 10
  },
  {
    id: 'team',
    labelKey: 'pricing.plan.team.label',
    totalReleasesLimit: 40,
    totalDeploymentsLimit: 20,
    maxWorkerConcurrency: 20
  }
]
