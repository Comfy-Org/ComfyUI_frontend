/**
 * The open-weight models the Hub's Models page lists: every published
 * supported-models page for a diffusion model or checkpoint people browse,
 * described by the template its page already takes its artwork from.
 *
 * Run after refreshing the models or the template snapshot:
 *   pnpm exec tsx scripts/generate-open-weight-models.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { websiteRoot } from '@website/paths'
import type { Model } from '@/config/models'
import { models } from '@/config/models'
import type { UseCase } from '@/config/models-catalogue'
import { hubTemplatesSchema } from '@/lib/hub/types'
import type { HubTemplate } from '@/lib/hub/types'
import type {
  OpenWeightModel,
  OpenWeightModality,
  OpenWeightTask
} from '@/lib/workshop/explorer/open-weight-models'
import { isDirectExecution } from './script-entry-point'

const OUTPUT = join(
  websiteRoot,
  'src/lib/workshop/explorer/open-weight-models.generated.json'
)

const BROWSED_DIRECTORIES: readonly Model['directory'][] = [
  'diffusion_models',
  'checkpoints'
]

// Detectors, segmenters and estimators ship as diffusion-model files but are
// parts of a workflow, not models people pick to make something.
const AUX_SLUG_PREFIXES = ['sam3', 'sdpose', 'rt-detr', 'lotus-depth']

const PROVIDER_BY_SLUG_PREFIX: readonly (readonly [string, string])[] = [
  ['flux', 'Black Forest Labs'],
  ['wan', 'Wan'],
  ['qwen', 'Qwen'],
  ['ltx', 'Lightricks'],
  ['hunyuan', 'Tencent'],
  ['hidream', 'HiDream'],
  ['z-image', 'Tongyi'],
  ['ideogram', 'Ideogram'],
  ['minimax', 'MiniMax'],
  ['sd-', 'Stability AI'],
  ['sd3', 'Stability AI'],
  ['stable-audio', 'Stability AI'],
  ['svd', 'Stability AI']
]

const MODALITIES: readonly OpenWeightModality[] = [
  'image',
  'video',
  'audio',
  '3d'
]
const EDIT_TAGS = ['Image Edit', 'Video Edit', 'Inpainting', 'Outpainting']
const UPSCALE_TAGS = ['Image Upscale', 'Video Upscale']
const ANIMATE_TAGS = ['Image to Video', 'FLF2V']
const VIDEO_EDIT_TAGS = ['Video Edit', 'Video to Video']

function templateNameOf(thumbnailUrl: string): string {
  const file = decodeURIComponent(thumbnailUrl.split('/').at(-1) ?? '')
  return file.replace(/-1\.webp$/, '')
}

function hasAny(tags: readonly string[], wanted: readonly string[]): boolean {
  return tags.some((tag) => wanted.includes(tag))
}

function useCaseOf(
  modality: OpenWeightModality,
  tags: readonly string[]
): UseCase {
  if (modality === 'image')
    return hasAny(tags, EDIT_TAGS) ? 'edit-images' : 'generate-images'
  if (modality === 'video') {
    if (hasAny(tags, VIDEO_EDIT_TAGS)) return 'edit-videos'
    return hasAny(tags, ANIMATE_TAGS) ? 'animate-images' : 'generate-videos'
  }
  return modality
}

function tasksOf(tags: readonly string[]): OpenWeightTask[] {
  return [
    ...(hasAny(tags, EDIT_TAGS) ? (['edit'] as const) : []),
    ...(hasAny(tags, UPSCALE_TAGS) ? (['upscale'] as const) : [])
  ]
}

function entryFor(
  model: Model,
  template: HubTemplate
): OpenWeightModel | undefined {
  const modality = MODALITIES.find((value) => value === template.mediaType)
  if (!modality || !model.thumbnailUrl) return undefined
  const provider = PROVIDER_BY_SLUG_PREFIX.find(([prefix]) =>
    model.slug.startsWith(prefix)
  )?.[1]
  return {
    slug: model.slug,
    name: model.displayName,
    ...(provider ? { provider } : {}),
    modality,
    useCase: useCaseOf(modality, template.tags),
    tasks: tasksOf(template.tags),
    thumbnailUrl: model.thumbnailUrl
  }
}

export function openWeightModelsFrom(
  models: readonly Model[],
  templates: readonly HubTemplate[]
): OpenWeightModel[] {
  const byName = new Map(templates.map((template) => [template.name, template]))
  return models
    .filter(
      (model) =>
        model.canonicalSlug === undefined &&
        BROWSED_DIRECTORIES.includes(model.directory) &&
        !AUX_SLUG_PREFIXES.some((prefix) => model.slug.startsWith(prefix))
    )
    .toSorted((a, b) => b.workflowCount - a.workflowCount)
    .flatMap((model) => {
      const template =
        model.thumbnailUrl && byName.get(templateNameOf(model.thumbnailUrl))
      return (template && entryFor(model, template)) || []
    })
}

function main() {
  const templates = hubTemplatesSchema.parse(
    JSON.parse(
      readFileSync(join(websiteRoot, 'src/data/hubTemplates.json'), 'utf8')
    )
  )
  const list = openWeightModelsFrom(models, templates)
  writeFileSync(OUTPUT, `${JSON.stringify(list, null, 2)}\n`)
  process.stdout.write(`Wrote ${list.length} open-weight models.\n`)
}

if (isDirectExecution(process.argv[1], import.meta.filename)) main()
