import generatedModels from './generated-models.json'
import { modelMetadata } from './model-metadata'

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

interface Model {
  readonly slug: string
  readonly canonicalSlug?: string
  readonly name: string
  readonly displayName: string
  readonly directory: ModelDirectory
  readonly huggingFaceUrl: string
  readonly thumbnailUrl?: string
  readonly docsUrl?: string
  readonly blogUrl?: string
  readonly featured: boolean
  readonly workflowCount: number
}

export const models: readonly Model[] = (
  generatedModels as Array<{
    slug: string
    canonicalSlug?: string
    name: string
    displayName: string
    directory: string
    huggingFaceUrl: string
    thumbnailUrl?: string
    workflowCount: number
  }>
).map((m) => ({
  slug: m.slug,
  ...(m.canonicalSlug ? { canonicalSlug: m.canonicalSlug } : {}),
  name: m.name,
  displayName: m.displayName,
  directory: m.directory as ModelDirectory,
  huggingFaceUrl: m.huggingFaceUrl,
  ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}),
  featured: false,
  workflowCount: m.workflowCount,
  ...modelMetadata[m.slug]
}))

export function getModelBySlug(slug: string): Model | undefined {
  return models.find((m) => m.slug === slug)
}
