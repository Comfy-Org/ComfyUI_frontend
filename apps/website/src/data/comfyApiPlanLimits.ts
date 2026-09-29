import type { TranslationKey } from '../i18n/translations'

export interface ComfyApiPlanLimits {
  id: string
  labelKey: TranslationKey
  totalBuildsLimit: number
  totalDeploymentsLimit: number
  maxWorkerConcurrency: number
}

export const comfyApiPlanLimits: readonly ComfyApiPlanLimits[] = [
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    totalBuildsLimit: 5,
    totalDeploymentsLimit: 2,
    maxWorkerConcurrency: 2
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    totalBuildsLimit: 5,
    totalDeploymentsLimit: 2,
    maxWorkerConcurrency: 2
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    totalBuildsLimit: 10,
    totalDeploymentsLimit: 5,
    maxWorkerConcurrency: 10
  },
  {
    id: 'team',
    labelKey: 'pricing.plan.team.label',
    totalBuildsLimit: 40,
    totalDeploymentsLimit: 20,
    maxWorkerConcurrency: 20
  }
]
