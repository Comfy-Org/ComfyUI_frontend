import type { WorkflowWorkshopModel } from '@/config/models-catalogue'

export interface WorkflowSection {
  readonly id: string
  readonly label: string
  readonly models: readonly WorkflowWorkshopModel[]
}

/** The element id a Workflows section is linked to by. */
export function sectionAnchor(id: string): string {
  return `section-${id}`
}

/** The use-case sections that hold a workflow, in editorial order, keeping the order of `models` within each. */
export function workflowSections(
  models: readonly WorkflowWorkshopModel[],
  locale: 'en' | 'zh-CN'
): WorkflowSection[] {
  const grouped = Map.groupBy(
    models.filter((model) => model.section),
    (model) => model.section ?? ''
  )
  return [...grouped.values()]
    .toSorted(
      ([a], [b]) => (a.sectionOrder ?? Infinity) - (b.sectionOrder ?? Infinity)
    )
    .map((listed) => ({
      id: listed[0].section ?? '',
      label: listed[0].sectionLabel?.[locale] ?? listed[0].section ?? '',
      models: listed
    }))
}

/** Whether every workflow names the section it is listed under. */
export function allSectioned(models: readonly WorkflowWorkshopModel[]) {
  return models.length > 0 && models.every((model) => model.section)
}

/**
 * The section a shared address names when it names no type category, so a
 * link to a retired use-case category still lands on its section.
 */
export function sectionFromAddress(
  search: string,
  models: readonly WorkflowWorkshopModel[]
): string | undefined {
  const named = new URLSearchParams(search).getAll('category')
  const isType = (id: string) =>
    models.some(
      (model) => model.category === id || model.categoryAliases?.includes(id)
    )
  if (named.some(isType)) return undefined
  return named.find((id) => models.some((model) => model.section === id))
}

/** The section a hash such as `#section-videos` names, if one lists a workflow. */
export function sectionFromHash(
  hash: string,
  models: readonly WorkflowWorkshopModel[]
): string | undefined {
  return models.find(
    (model) => model.section && `#${sectionAnchor(model.section)}` === hash
  )?.section
}
