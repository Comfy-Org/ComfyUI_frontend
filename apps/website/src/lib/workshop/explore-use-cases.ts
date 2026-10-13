import type { UseCase, WorkshopModel } from '@/config/models-catalogue'
import {
  catalogSearch,
  sortWorkshopModels,
  USE_CASES,
  useCasesFor
} from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { stillOf } from './explore-art'

export interface UseCaseTile {
  readonly useCase: UseCase
  readonly catalogue: 'models' | 'workflows'
  readonly count: number
  readonly href: string
  readonly still?: string
}

function inUseCase(list: readonly WorkshopModel[], useCase: UseCase) {
  return list.filter((model) => useCasesFor(model).includes(useCase))
}

/**
 * One tile per Best-for use case that lists something: the Models catalogue
 * filtered to it, or the Workflows catalogue when only workflows have it.
 */
export function useCaseTiles(
  catalogue: {
    readonly models: readonly WorkshopModel[]
    readonly workflows: readonly WorkshopModel[]
  },
  locale: Locale = 'en'
): UseCaseTile[] {
  const routes = getRoutes(locale)
  return USE_CASES.flatMap((useCase) => {
    const models = inUseCase(catalogue.models, useCase)
    const workflows = inUseCase(catalogue.workflows, useCase)
    const [catalogueName, listed, base] = models.length
      ? (['models', models, routes.workshop] as const)
      : (['workflows', workflows, routes.hubWorkflows] as const)
    if (!listed.length) return []
    const still = sortWorkshopModels([...models, ...workflows], 'popular')
      .map((model) => stillOf(model.thumbnail))
      .find((src) => src !== undefined)
    return [
      {
        useCase,
        catalogue: catalogueName,
        count: listed.length,
        href: base + catalogSearch({ useCase }),
        ...(still && { still })
      }
    ]
  })
}
