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
  readonly still?: string
}

function byRecommendation(a: WorkflowWorkshopModel, b: WorkflowWorkshopModel) {
  return (
    (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity) ||
    b.workflowCount - a.workflowCount
  )
}

/**
 * One tile per Workflows category that lists something, in the sidebar's
 * order, fronted by a still from its most recommended workflow.
 */
export function categoryTiles(
  workflows: readonly WorkflowWorkshopModel[],
  locale: Locale = 'en'
): CategoryTile[] {
  const catalogue = getRoutes(locale).hubWorkflows
  return workflowCategories(workflows, locale === 'zh-CN' ? locale : 'en').map(
    ({ id, label, count }) => {
      const still = workflows
        .filter((workflow) => workflow.category === id)
        .toSorted(byRecommendation)
        .map((workflow) => stillOf(workflow.thumbnail))
        .find((src) => src !== undefined)
      return {
        id,
        label,
        count,
        href: `${catalogue}?${new URLSearchParams({ category: id })}`,
        ...(still && { still })
      }
    }
  )
}
