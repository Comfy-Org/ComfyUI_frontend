import generatedModels from './generated-models.json'
import { modelMetadata } from './model-metadata'

export type ModelDirectory =
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
  readonly docsUrl?: string
  readonly blogUrl?: string
  readonly featured: boolean
  readonly workflowCount: number
  readonly publishedDate: string
  readonly modifiedDate: string
}

const TODAY = '2026-05-04'

export const models: readonly Model[] = (
  generatedModels as Array<{
    slug: string
    canonicalSlug?: string
    name: string
    displayName: string
    directory: string
    huggingFaceUrl: string
    workflowCount: number
  }>
).map((m) => ({
  slug: m.slug,
  ...(m.canonicalSlug ? { canonicalSlug: m.canonicalSlug } : {}),
  name: m.name,
  displayName: m.displayName,
  directory: m.directory as ModelDirectory,
  huggingFaceUrl: m.huggingFaceUrl,
  featured: false,
  workflowCount: m.workflowCount,
  publishedDate: TODAY,
  modifiedDate: TODAY,
  ...modelMetadata[m.slug]
}))

export function getModelBySlug(slug: string): Model | undefined {
  return models.find((m) => m.slug === slug)
}

export function getFeaturedModels(): readonly Model[] {
  return models.filter((m) => m.featured)
}

export function getModelsByDirectory(dir: ModelDirectory): readonly Model[] {
  return models.filter((m) => m.directory === dir)
}
