import type { TranslationKey } from '@/i18n/translations'

type DesignDecisionPage = 'models' | 'workflows'

export interface DesignDecision {
  readonly anchor: string
  readonly page: DesignDecisionPage
  readonly titleKey: TranslationKey
  readonly bodyKey: TranslationKey
}

export const DESIGN_DECISIONS: readonly DesignDecision[] = [
  {
    anchor: 'models-sidebar',
    page: 'models',
    titleKey: 'designDecisions.models.sidebar.title',
    bodyKey: 'designDecisions.models.sidebar.body'
  },
  {
    anchor: 'models-filters',
    page: 'models',
    titleKey: 'designDecisions.models.filters.title',
    bodyKey: 'designDecisions.models.filters.body'
  },
  {
    anchor: 'workflows-sidebar',
    page: 'workflows',
    titleKey: 'designDecisions.workflows.sidebar.title',
    bodyKey: 'designDecisions.workflows.sidebar.body'
  },
  {
    anchor: 'workflows-filters',
    page: 'workflows',
    titleKey: 'designDecisions.workflows.filters.title',
    bodyKey: 'designDecisions.workflows.filters.body'
  }
]
