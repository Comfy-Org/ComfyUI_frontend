import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { stillOf } from './explore-art'
import { sectionAnchor, workflowSections } from './workflow-sections'

export interface CategoryTile {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly href: string
  readonly stills: readonly string[]
}

const MOSAIC_STILLS = 4

function byRecommendation(a: WorkflowWorkshopModel, b: WorkflowWorkshopModel) {
  return (
    (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity) ||
    b.workflowCount - a.workflowCount
  )
}

/**
 * One tile per Workflows use-case section that lists something, in its
 * editorial order, with the stills of up to four of its most recommended workflows.
 */
export function categoryTiles(
  workflows: readonly WorkflowWorkshopModel[],
  locale: Locale = 'en'
): CategoryTile[] {
  const catalogue = getRoutes(locale).hubWorkflows
  return workflowSections(workflows, locale === 'zh-CN' ? locale : 'en').map(
    ({ id, label, models }) => ({
      id,
      label,
      count: models.length,
      href: `${catalogue}#${sectionAnchor(id)}`,
      stills: [
        ...new Set(
          models
            .toSorted(byRecommendation)
            .flatMap((workflow) => stillOf(workflow.thumbnail) ?? [])
        )
      ].slice(0, MOSAIC_STILLS)
    })
  )
}
