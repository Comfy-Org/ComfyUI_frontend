import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { filterWorkshopModels } from '@/config/models-catalogue'
import type { CatalogueApp } from './catalogue-apps'

export type ExploreKind = 'model' | 'workflow' | 'app'

export type ExploreEntry =
  | { readonly kind: 'app'; readonly app: CatalogueApp }
  | { readonly kind: 'workflow' | 'model'; readonly model: WorkshopModel }

export interface ExploreCount {
  readonly kind: 'models' | 'workflows' | 'apps'
  readonly count: number
  /** That kind's own page, narrowed to the query where it can be. */
  readonly href: string
}

export interface ExploreMatches {
  readonly apps: readonly CatalogueApp[]
  readonly workflows: readonly WorkflowWorkshopModel[]
  readonly models: readonly WorkshopModel[]
}

function namedFirst<T extends { readonly name: string }>(
  list: readonly T[],
  needle: string
): T[] {
  const leads = (item: T) => item.name.toLowerCase().startsWith(needle)
  return [...list].sort((a, b) => Number(leads(b)) - Number(leads(a)))
}

/**
 * Everything in the Hub a query finds: a model or workflow by what the
 * catalogue search reads (name, provider, use case, capabilities) or by its
 * summary, an app by its name or what it does. Names that start with the
 * query lead each kind.
 */
export function searchExplore(
  catalogue: ExploreMatches,
  query: string
): ExploreMatches {
  const needle = query.trim().toLowerCase()
  const matches = (model: WorkshopModel) =>
    filterWorkshopModels([model], { query: needle }).length > 0 ||
    (model.summary ?? '').toLowerCase().includes(needle)
  return {
    apps: namedFirst(
      catalogue.apps.filter((app) =>
        `${app.name} ${app.task}`.toLowerCase().includes(needle)
      ),
      needle
    ),
    workflows: namedFirst(catalogue.workflows.filter(matches), needle),
    models: namedFirst(catalogue.models.filter(matches), needle)
  }
}

/** One row of results: workflows, then apps, then models, up to `limit`. */
export function exploreRow(
  matches: ExploreMatches,
  limit: number
): ExploreEntry[] {
  return [
    ...matches.workflows.map((model) => ({ kind: 'workflow' as const, model })),
    ...matches.apps.map((app) => ({ kind: 'app' as const, app })),
    ...matches.models.map((model) => ({ kind: 'model' as const, model }))
  ].slice(0, limit)
}
