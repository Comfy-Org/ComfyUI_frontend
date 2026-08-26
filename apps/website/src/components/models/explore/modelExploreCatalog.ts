import type { Model } from '../../../config/models'
import type { ModelCategory } from '../../../config/modelCategories'

import type { ModelMediaTone } from './modelExploreFixtures'

export interface ModelExploreCatalogSummary {
  catalogCount: number
  localComponentCount: number
  partnerIntegrationCount: number
}

export interface ModelExploreCatalogItem {
  slug: string
  title: string
  href: string
  directory: Model['directory']
  workflowCount: number
  categories: readonly ModelCategory[]
  thumbnailUrl?: string
  mediaTone: ModelMediaTone
  searchText: string
}

export type ModelAccessFilter = 'all' | 'open' | 'partner'

const categoryTones: Readonly<Partial<Record<ModelCategory, ModelMediaTone>>> =
  {
    image: 'ember',
    video: 'plum',
    audio: 'canvas',
    '3d': 'forest',
    edit: 'ember',
    upscale: 'canvas',
    llm: 'forest',
    train: 'plum'
  }

function resolveMediaTone(category: ModelCategory | undefined): ModelMediaTone {
  return category ? (categoryTones[category] ?? 'plum') : 'plum'
}

export function createModelExploreCatalog(
  catalog: readonly Model[]
): ModelExploreCatalogItem[] {
  return catalog
    .filter(({ canonicalSlug }) => canonicalSlug === undefined)
    .map((model) => ({
      slug: model.slug,
      title: model.displayName,
      href: `/p/supported-models/${model.slug}`,
      directory: model.directory,
      workflowCount: model.workflowCount,
      categories: model.categories,
      ...(model.thumbnailUrl ? { thumbnailUrl: model.thumbnailUrl } : {}),
      mediaTone: resolveMediaTone(model.categories[0]),
      searchText: [
        model.displayName,
        model.name,
        model.directory,
        ...model.categories
      ]
        .join(' ')
        .toLowerCase()
    }))
}

export function filterModelExploreCatalog(
  catalog: readonly ModelExploreCatalogItem[],
  query: string,
  category: 'all' | ModelCategory,
  access: ModelAccessFilter = 'all'
): ModelExploreCatalogItem[] {
  const queryTerms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  return catalog.filter(
    (model) =>
      (category === 'all' || model.categories.includes(category)) &&
      (access === 'all' ||
        (access === 'partner') === (model.directory === 'partner_nodes')) &&
      queryTerms.every((term) => model.searchText.includes(term))
  )
}

export function summarizeModelExploreCatalog(
  catalog: readonly Pick<Model, 'directory'>[]
): ModelExploreCatalogSummary {
  const partnerIntegrationCount = catalog.filter(
    ({ directory }) => directory === 'partner_nodes'
  ).length

  return {
    catalogCount: catalog.length,
    localComponentCount: catalog.length - partnerIntegrationCount,
    partnerIntegrationCount
  }
}
