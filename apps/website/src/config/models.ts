import generatedModels from './generated-models.json'
import { modelMetadata } from './model-metadata'
import type { ModelCategory } from './modelCategories'

type ModelDirectory =
  | 'diffusion_models'
  | 'checkpoints'
  | 'loras'
  | 'controlnet'
  | 'clip_vision'
  | 'model_patches'
  | 'vae'
  | 'text_encoders'
  | 'audio_encoders'
  | 'latent_upscale_models'
  | 'upscale_models'
  | 'style_models'
  | 'partner_nodes'

export interface Model {
  readonly slug: string
  readonly canonicalSlug?: string
  readonly name: string
  readonly displayName: string
  readonly directory: ModelDirectory
  readonly huggingFaceUrl: string
  readonly thumbnailUrl?: string
  readonly docsUrl?: string
  readonly blogUrl?: string
  readonly hubSlug?: string
  readonly featured: boolean
  readonly workflowCount: number
  readonly categories: readonly ModelCategory[]
  readonly workflowPreviews: readonly ModelWorkflowPreview[]
}

interface ModelWorkflowPreview {
  readonly id: string
  readonly title: string
  readonly thumbnailUrl: string
}

export const models: readonly Model[] = (
  generatedModels as Array<{
    slug: string
    canonicalSlug?: string
    name: string
    displayName: string
    directory: string
    huggingFaceUrl: string
    docsUrl?: string
    thumbnailUrl?: string
    workflowCount: number
    categories?: ModelCategory[]
    workflowPreviews?: ModelWorkflowPreview[]
  }>
).map((m) => ({
  slug: m.slug,
  ...(m.canonicalSlug ? { canonicalSlug: m.canonicalSlug } : {}),
  name: m.name,
  displayName: m.displayName,
  directory: m.directory as ModelDirectory,
  huggingFaceUrl: m.huggingFaceUrl,
  ...(m.docsUrl ? { docsUrl: m.docsUrl } : {}),
  ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}),
  featured: false,
  workflowCount: m.workflowCount,
  categories: m.categories ?? [],
  workflowPreviews: m.workflowPreviews ?? [],
  ...modelMetadata[m.slug]
}))

const slugSet = new Set(models.map((m) => m.slug))
if (slugSet.size !== models.length) {
  for (const model of models) {
    if (models.filter((m) => m.slug === model.slug).length > 1) {
      throw new Error(`Duplicate model slug: ${model.slug}`)
    }
  }
}
for (const model of models) {
  if (
    model.canonicalSlug !== undefined &&
    (!slugSet.has(model.canonicalSlug) || model.canonicalSlug === model.slug)
  ) {
    throw new Error(
      `Invalid canonicalSlug "${model.canonicalSlug}" on "${model.slug}"`
    )
  }
}

export function getModelBySlug(slug: string): Model | undefined {
  return models.find((m) => m.slug === slug)
}
