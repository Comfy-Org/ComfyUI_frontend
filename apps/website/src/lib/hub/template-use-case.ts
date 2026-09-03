import type { UseCase, WorkshopModel } from '../../config/workshop'
import { useCaseFor } from '../../config/workshop'
import type { HubTemplate } from './types'

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

// The catalogue names its models as free text ("Wan2.7", "FLUX 3 Video"), so
// only an exact match after normalising is safe: a substring match sends a
// FLUX video workflow to an image playground.
export function partnerModelFor(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): WorkshopModel | undefined {
  if (!template.tags.includes('API')) return undefined
  const names = template.models.map(normalize)
  return models.find((model) => names.includes(normalize(model.name)))
}

// What the workflow does, in the vocabulary the models catalogue already uses.
// The index's own mediaType describes the thumbnail, not the output, so the
// task tags decide; the broader tags only break a tie.
const TASK_TAGS: Readonly<Record<string, UseCase>> = {
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

// What is left names a conditioning method, not a task: ControlNet, a pose map,
// a style or character reference. Those all condition a generation, so the
// medium decides the row.
const MEDIA_TAGS: Readonly<Record<string, UseCase>> = {
  'Motion Control': 'animate-images',
  '3D': '3d',
  Music: 'audio',
  Audio: 'audio',
  Video: 'generate-videos',
  Image: 'generate-images',
  ControlNet: 'generate-images',
  'Style Reference': 'generate-images',
  'Character Reference': 'generate-images',
  'Pose Map': 'generate-images',
  Anime: 'generate-images',
  Portrait: 'generate-images',
  'Brand Design': 'generate-images',
  Game: 'generate-images',
  Vector: 'generate-images',
  LoRA: 'generate-images'
}

function fromTags(
  tags: readonly string[],
  table: Readonly<Record<string, UseCase>>
): UseCase | undefined {
  for (const tag of Object.keys(table)) {
    if (tags.includes(tag)) return table[tag]
  }
  return undefined
}

export function useCaseForTemplate(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): UseCase | undefined {
  const partner = partnerModelFor(template, models)
  return (
    fromTags(template.tags, TASK_TAGS) ??
    (partner ? useCaseFor(partner) : undefined) ??
    fromTags(template.tags, MEDIA_TAGS)
  )
}
