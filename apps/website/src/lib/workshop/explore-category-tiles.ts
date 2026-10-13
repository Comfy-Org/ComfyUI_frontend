import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { stillOf } from './explore-art'
import { workflowCategories } from './workflow-categories'

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
 * One tile per Workflows category that lists something, in the sidebar's
 * order, with the stills of up to four of its most recommended workflows.
 */
export function categoryTiles(
  workflows: readonly WorkflowWorkshopModel[],
  locale: Locale = 'en'
): CategoryTile[] {
  const catalogue = getRoutes(locale).hubWorkflows
  return workflowCategories(workflows, locale === 'zh-CN' ? locale : 'en').map(
    ({ id, label, count }) => {
      const stills = [
        ...new Set(
          workflows
            .filter((workflow) => workflow.category === id)
            .toSorted(byRecommendation)
            .flatMap((workflow) => stillOf(workflow.thumbnail) ?? [])
        )
      ].slice(0, MOSAIC_STILLS)
      return {
        id,
        label,
        count,
        href: `${catalogue}?${new URLSearchParams({ category: id })}`,
        stills
      }
    }
  )
}
