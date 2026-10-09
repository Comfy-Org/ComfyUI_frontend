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
    anchor: 'models-chips',
    page: 'models',
    titleKey: 'designDecisions.models.chips.title',
    bodyKey: 'designDecisions.models.chips.body'
  },
  {
    anchor: 'workflows-chips',
    page: 'workflows',
    titleKey: 'designDecisions.workflows.chips.title',
    bodyKey: 'designDecisions.workflows.chips.body'
  }
]
