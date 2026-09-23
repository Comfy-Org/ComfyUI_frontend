import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { useCaseFor, useCasesFor } from '../../config/models-catalogue'
import templateModelJoin from '../../data/templateModelJoin.json'
import { modelName } from './model-identity'
import type { HubTemplate } from './types'

// Generated canonical content-page slugs, not display-family names. Tasks
// describe the operation; mediaType describes only a workflow's thumbnail.
const JOINED_SLUG = new Map(Object.entries(templateModelJoin))

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function uniqueModel(models: readonly WorkshopModel[]) {
  return models.length === 1 ? models[0] : undefined
}

function taskUseCases(template: HubTemplate): Set<UseCase> {
  return new Set(
    template.tags.flatMap((tag) => {
      // These authored reference operations live in animate-images. Other
      // reference models have distinct generate-videos pages; changing the
      // global tag would send them to first/last-frame operations instead.
      const useCase =
        ['api_happyhorse1_1_r2v', 'api_seedance2_5_r2v'].includes(
          template.name
        ) && tag === 'Reference to Video'
          ? 'animate-images'
          : TASK_TAGS[tag]
      return useCase ? [useCase] : []
    })
  )
}

function modelsForTask(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): readonly WorkshopModel[] {
  const useCases = taskUseCases(template)
  if (useCases.size > 1) return []
  const useCase = [...useCases].at(0)
  return useCase
    ? models.filter((model) => useCasesFor(model).includes(useCase))
    : models
}

// The catalogue names its models as free text ("Wan2.7", "FLUX 3 Video"), so
// only an exact match after normalising is safe: a substring match sends a
// FLUX video workflow to an image playground.
export function modelNamedBy(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): WorkshopModel | undefined {
  if (!template.tags.includes('API')) return undefined
  const names = template.models.map(normalize)
  // A template names the model in whatever words the registry used when it was
  // written, so an operation answers to its own name and to the model's.
  const named = (model: WorkshopModel) =>
    names.includes(normalize(model.name)) ||
    names.includes(normalize(modelName(model, models)))
  return uniqueModel(modelsForTask(template, models).filter(named))
}

export function partnerModelFor(
  template: HubTemplate,
  models: readonly WorkshopModel[],
  joinedSlug = JOINED_SLUG.get(template.name)
): WorkshopModel | undefined {
  if (!template.tags.includes('API')) return undefined
  const target = uniqueModel(
    models.filter((model) => model.slug === joinedSlug)
  )
  if (target && modelsForTask(template, models).includes(target)) return target
  return modelNamedBy(template, models)
}

// What the workflow does, in the vocabulary the models catalogue already uses.
// The index's own mediaType describes the thumbnail, not the output, so the
// task tags decide; the broader tags only break a tie.
const TASK_TAGS: Readonly<Partial<Record<string, UseCase>>> = {
  'Image to 3D': '3d',
  'Text to Model': '3d',
  'Image to Model': '3d',
  'Text to Speech': 'audio',
  TTS: 'audio',
  'Speech to Text': 'audio',
  'Voice Cloning': 'audio',
  'Text to Music': 'audio',
  'Text to Audio': 'audio',
  'Audio Editing': 'audio',
  'Text Generation': 'text',
  'Video Edit': 'edit-videos',
  'Video to Video': 'edit-videos',
  'Video Extend': 'edit-videos',
  'Video Upscale': 'edit-videos',
  'Frame Interpolation': 'edit-videos',
  'Image to Video': 'animate-images',
  FLF2V: 'animate-images',
  'Lip Sync': 'animate-images',
  'Audio to Video': 'animate-images',
  'Character Replacement': 'animate-images',
  'Text to Video': 'generate-videos',
  'Reference to Video': 'generate-videos',
  'Image Edit': 'edit-images',
  Inpainting: 'edit-images',
  Outpainting: 'edit-images',
  'Image Upscale': 'edit-images',
  Relight: 'edit-images',
  'Remove Background': 'edit-images',
  'Style Transfer': 'edit-images',
  'Layer Decompose': 'edit-images',
  'Element Segmentation': 'edit-images',
  'Virtual Try-On': 'edit-images',
  'Text to Image': 'generate-images'
}

// Motion control animates a subject, which the medium alone cannot say. What
// is left names a conditioning method — ControlNet, a pose map, a style
// reference — so it conditions a generation of whatever the workflow outputs.
const TASK_FALLBACK_TAGS: Readonly<Record<string, UseCase>> = {
  'Motion Control': 'animate-images'
}

const GENERATED_MEDIUM: Readonly<Record<string, UseCase>> = {
  image: 'generate-images',
  video: 'generate-videos',
  audio: 'audio',
  '3d': '3d'
}

function fromTags(
  tags: readonly string[],
  table: Readonly<Partial<Record<string, UseCase>>>
): UseCase | undefined {
  for (const tag of Object.keys(table)) {
    if (tags.includes(tag)) return table[tag]
  }
  return undefined
}

/**
 * Whether a tag says only what the page's own use case already says. The
 * header shows the use case as a pill, so repeating it in the tag row beside
 * it gives the reader the same fact twice in different words.
 */
export function namesUseCase(tag: string, useCase: UseCase | undefined) {
  return useCase !== undefined && TASK_TAGS[tag] === useCase
}

export function useCaseForTemplate(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): UseCase | undefined {
  const partner = partnerModelFor(template, models)
  const tasks = [...taskUseCases(template)]
  return (
    (tasks.length === 1 ? tasks[0] : undefined) ??
    (partner ? useCaseFor(partner) : undefined) ??
    fromTags(template.tags, TASK_FALLBACK_TAGS) ??
    GENERATED_MEDIUM[template.mediaType]
  )
}
