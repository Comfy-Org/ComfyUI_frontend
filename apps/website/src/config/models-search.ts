import type { SearchableTemplate } from '@comfyorg/shared-frontend-utils/templateSearch'
import {
  createTemplateSearchIndex,
  searchTemplates
} from '@comfyorg/shared-frontend-utils/templateSearch'
import { compact } from 'es-toolkit'

import type { WorkshopFilter, WorkshopModel } from './models-catalogue'
import { filterWorkshopModels, useCasesFor } from './models-catalogue'

function searchable(model: WorkshopModel): SearchableTemplate {
  const workflow =
    model.type === 'CLOUD' || model.type === 'SERVERLESS' ? model : undefined
  return {
    name: model.slug,
    title: model.name,
    models: compact([
      ...(workflow?.models ?? []),
      model.provider,
      workflow?.author
    ]),
    tags: compact([
      ...useCasesFor(model),
      ...model.capabilities,
      model.task,
      workflow?.category
    ])
  }
}

// One index per list identity; never mutate a list in place.
const searchIndexes = new WeakMap<
  readonly WorkshopModel[],
  ReturnType<typeof createTemplateSearchIndex>
>()

function searchIndexFor(list: readonly WorkshopModel[]) {
  const cached = searchIndexes.get(list)
  if (cached) return cached
  const index = createTemplateSearchIndex(list.map(searchable))
  searchIndexes.set(list, index)
  return index
}

/**
 * `filterWorkshopModels` with the query matched by the templates modal's
 * search. Anything the plain substring match finds is kept as well.
 */
export function searchWorkshopModels(
  list: readonly WorkshopModel[],
  filter: WorkshopFilter
): WorkshopModel[] {
  const faceted = filterWorkshopModels(list, { ...filter, query: '' })
  const query = filter.query?.trim() ?? ''
  if (!query) return faceted
  const found = new Set([
    ...searchTemplates(searchIndexFor(list), query),
    ...filterWorkshopModels(list, { query }).map((model) => model.slug)
  ])
  return faceted.filter((model) => found.has(model.slug))
}
