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

const componentDirectories = new Set<Model['directory']>([
  'vae',
  'text_encoders',
  'clip_vision',
  'audio_encoders',
  'embeddings'
])
const categoryOverrides: Readonly<
  Partial<Record<string, readonly ModelCategory[]>>
> = {
  'qwen-image-edit-2511-bf16': ['image', 'edit'],
  'qwen-image-edit-2511-lightning-4steps-v1-0-bf16': ['image', 'edit'],
  'qwen-image-edit-2511-multiple-angles-lora': ['image', 'edit'],
  'qwen-360-diffusion-2512-int8-bf16-v2': ['image'],
  'sam3-1-multiplex-fp16': ['image', 'video', 'edit'],
  birefnet: ['image', 'edit'],
  'rt-detr-v4-x-hgnet-fp32': ['image']
}

export function createModelExploreCatalog(
  catalog: readonly Model[]
): ModelExploreCatalogItem[] {
  return catalog
    .filter(({ canonicalSlug }) => canonicalSlug === undefined)
    .map((model) => {
      const categories = componentDirectories.has(model.directory)
        ? []
        : (categoryOverrides[model.slug] ?? model.categories ?? [])
      return {
        slug: model.slug,
        title: model.displayName,
        href: `/p/supported-models/${model.slug}/`,
        directory: model.directory,
        workflowCount: model.workflowCount,
        categories,
        ...(model.thumbnailUrl ? { thumbnailUrl: model.thumbnailUrl } : {}),
        mediaTone: resolveMediaTone(categories[0]),
        searchText: [
          model.displayName,
          model.name,
          model.directory,
          ...categories
        ]
          .join(' ')
          .toLowerCase()
      }
    })
}

export function filterModelExploreCatalog<
  T extends Pick<
    ModelExploreCatalogItem,
    'categories' | 'directory' | 'searchText'
  >
>(
  catalog: readonly T[],
  query: string,
  category: 'all' | ModelCategory,
  access: ModelAccessFilter = 'all'
): T[] {
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
  catalog: readonly Pick<Model, 'directory' | 'canonicalSlug'>[]
): ModelExploreCatalogSummary {
  const canonicalModels = catalog.filter(({ canonicalSlug }) => !canonicalSlug)
  const partnerIntegrationCount = canonicalModels.filter(
    ({ directory }) => directory === 'partner_nodes'
  ).length
  return {
    catalogCount: canonicalModels.length,
    localComponentCount: canonicalModels.length - partnerIntegrationCount,
    partnerIntegrationCount
  }
}
