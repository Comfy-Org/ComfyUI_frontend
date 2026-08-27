import type { Model } from '../../../config/models'
import type { ModelCategory } from '../../../config/modelCategories'
import type { ModelRelease } from '../../../config/modelReleases'

import type { ModelMediaTone } from './modelExploreFixtures'

export interface ModelExploreCatalogSummary {
  catalogCount: number
  localComponentCount: number
  partnerIntegrationCount: number
}

export interface ModelExploreCatalogItem {
  kind: 'release' | 'component'
  slug: string
  title: string
  href: string
  directory: Model['directory']
  workflowCount: number
  componentCount?: number
  publisher?: string
  access: ModelAccessFilter
  categories: readonly ModelCategory[]
  releaseDate?: string
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
    .map((model) => {
      const releaseDate = model.workflowPreviews
        .map(({ publishedAt }) => publishedAt)
        .filter((date): date is string => date !== undefined)
        .sort((a, b) => b.localeCompare(a))[0]

      return {
        kind: 'component' as const,
        slug: model.slug,
        title: model.displayName,
        href: `/p/supported-models/${model.slug}`,
        directory: model.directory,
        workflowCount: model.workflowCount,
        access:
          model.directory === 'partner_nodes'
            ? ('partner' as const)
            : ('open' as const),
        categories: model.categories,
        ...(releaseDate ? { releaseDate } : {}),
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
      }
    })
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
}

export function createModelReleaseExploreCatalog(
  releases: readonly ModelRelease[]
): ModelExploreCatalogItem[] {
  return releases
    .filter(({ workflows, thumbnailUrl }) =>
      Boolean(workflows.length && thumbnailUrl)
    )
    .map((release) => ({
      kind: 'release',
      slug: release.slug,
      title: release.displayName,
      href: `/p/supported-models/${release.slug}`,
      directory:
        release.access === 'partner'
          ? 'partner_nodes'
          : (release.components[0]?.directory ?? 'diffusion_models'),
      workflowCount: release.workflows.length,
      componentCount: release.components.length,
      publisher: release.publisher,
      access: release.access,
      categories: release.categories,
      ...(release.thumbnailUrl ? { thumbnailUrl: release.thumbnailUrl } : {}),
      mediaTone: resolveMediaTone(release.categories[0]),
      searchText: [
        release.displayName,
        release.publisher,
        release.familySlug,
        ...release.categories,
        ...release.components.map(({ displayName }) => displayName)
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
      (access === 'all' || model.access === access) &&
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
