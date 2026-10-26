import type { WorkflowWorkshopModel } from '@/config/models-catalogue'

const WORKFLOW_CATEGORY_PARAM = 'category'
export const ALL_WORKFLOWS = 'all'

export interface WorkflowCategory {
  readonly id: string
  readonly label: string
  readonly count: number
}

/** The categories that list at least one workflow, in editorial order. */
export function workflowCategories(
  models: readonly WorkflowWorkshopModel[],
  locale: 'en' | 'zh-CN'
): WorkflowCategory[] {
  const counts = new Map<string, number>()
  for (const model of models)
    if (model.category)
      counts.set(model.category, (counts.get(model.category) ?? 0) + 1)
  return models
    .filter(
      (model, index) =>
        model.category &&
        models.findIndex((other) => other.category === model.category) === index
    )
    .sort(
      (a, b) => (a.categoryOrder ?? Infinity) - (b.categoryOrder ?? Infinity)
    )
    .map((model) => ({
      id: model.category ?? '',
      label: model.categoryLabel?.[locale] ?? model.category ?? '',
      count: counts.get(model.category ?? '') ?? 0
    }))
}

/**
 * The category a shared address names. Links made before the categories
 * were renamed name the old id, which still opens its nearest successor.
 */
export function categoryFromAddress(
  search: string,
  models: readonly WorkflowWorkshopModel[]
): string {
  const named = new URLSearchParams(search).getAll(WORKFLOW_CATEGORY_PARAM)
  const found = named
    .flatMap((id) =>
      models.filter(
        (model) => model.category === id || model.categoryAliases?.includes(id)
      )
    )
    .at(0)
  return found?.category ?? ALL_WORKFLOWS
}

export function categoryAddress(href: string, category: string): string {
  const url = new URL(href)
  if (category === ALL_WORKFLOWS)
    url.searchParams.delete(WORKFLOW_CATEGORY_PARAM)
  else url.searchParams.set(WORKFLOW_CATEGORY_PARAM, category)
  return url.href
}
