import generatedModels from './generated-models.json'
import { modelMetadata } from './model-metadata'

export const MODEL_DIRECTORIES = [
  'diffusion_models',
  'checkpoints',
  'loras',
  'controlnet',
  'clip_vision',
  'model_patches',
  'vae',
  'text_encoders',
  'audio_encoders',
  'latent_upscale_models',
  'upscale_models',
  'style_models',
  'partner_nodes',
  'background_removal',
  'detection',
  'frame_interpolation',
  'geometry_estimation',
  'optical_flow'
] as const

export type ModelDirectory = (typeof MODEL_DIRECTORIES)[number]

const MODEL_DIRECTORY_SET: ReadonlySet<string> = new Set(MODEL_DIRECTORIES)

export function isModelDirectory(value: string): value is ModelDirectory {
  return MODEL_DIRECTORY_SET.has(value)
}

function toModelDirectory(value: string, slug: string): ModelDirectory {
  if (!isModelDirectory(value)) {
    throw new Error(
      `Unknown model directory ${JSON.stringify(value)} for model "${slug}". ` +
        `Add it to MODEL_DIRECTORIES in src/config/models.ts and give it a ` +
        `label and description on the supported-models pages.`
    )
  }
  return value
}

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
  readonly whatIsBacklinkUrl?: string
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
  }>
).map((m) => ({
  slug: m.slug,
  ...(m.canonicalSlug ? { canonicalSlug: m.canonicalSlug } : {}),
  name: m.name,
  displayName: m.displayName,
  directory: toModelDirectory(m.directory, m.slug),
  huggingFaceUrl: m.huggingFaceUrl,
  ...(m.docsUrl ? { docsUrl: m.docsUrl } : {}),
  ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}),
  featured: false,
  workflowCount: m.workflowCount,
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
