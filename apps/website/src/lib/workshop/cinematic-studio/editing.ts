import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { dimensions } from '../../../config/router-parameter-options'
import {
  mapRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import { workshopPageSchema } from '../../../config/workshop-page-state'
import { defaultValues } from '../../../config/workshop-playground'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'
import { ASPECT_RATIOS, directionOption } from './catalog'
import type { Direction, DirectionPart } from './catalog'
import { canRunModel } from './gate'
import type { CinematicModel } from './models'

const EDITING_MODELS: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--edit-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--edit-images': '/icons/ai-models/gemini.svg'
}

export interface CinematicEditingDescriptor {
  readonly aspects: readonly string[]
  readonly resolutions: readonly string[]
  readonly sizes: readonly string[]
  readonly defaultResolution?: string
}

export function cinematicEditingDescriptor(
  model: WorkshopModelDetail
): CinematicEditingDescriptor | undefined {
  if (!Object.hasOwn(EDITING_MODELS, model.slug) || !canRunModel(model)) return
  const schema = workshopPageSchema(model)
  if (
    !schema.some((field) => field.name === 'images' && field.kind === 'file') ||
    !schema.some((field) => field.name === 'prompt')
  )
    return
  const choices = (name: string) => {
    const field = schema.find((candidate) => candidate.name === name)
    return field?.kind === 'select'
      ? field.options.filter(
          (value): value is string => typeof value === 'string'
        )
      : []
  }
  const sizes = choices('size')
  const resolutions = choices('image_imageSize')
  const resolution = schema.find((field) => field.name === 'image_imageSize')
  const aspects = choices('image_aspectRatio')
  return {
    aspects: aspects.length
      ? aspects
      : ASPECT_RATIOS.filter((aspect) => {
          const ratio = dimensions(aspect.id)
          return (
            ratio &&
            sizes.some((size) => {
              const shape = dimensions(size)
              return (
                shape &&
                Math.abs(
                  shape.width / shape.height - ratio.width / ratio.height
                ) < 0.01
              )
            })
          )
        }).map((aspect) => aspect.id),
    resolutions,
    sizes,
    ...(resolution?.kind === 'select' &&
    typeof resolution.defaultValue === 'string'
      ? { defaultResolution: resolution.defaultValue }
      : {})
  }
}

export function runnableCinematicEditingModels(
  lookup: (slug: string) => WorkshopModelDetail | undefined
): readonly CinematicModel[] {
  return Object.entries(EDITING_MODELS).flatMap(([slug, logo]) => {
    const model = lookup(slug)
    if (!model || !cinematicEditingDescriptor(model)) return []
    return [
      {
        slug: model.slug,
        name: model.name,
        provider: model.provider ?? '',
        logo,
        mode: 'image' as const,
        ...(model.status === 'degraded' ? { degraded: true } : {})
      }
    ]
  })
}

export interface CinematicEditingSettings {
  readonly sourceFile?: File
  readonly prompt: string
  readonly aspect?: string
  readonly resolution?: string
}

export function cinematicEditingForm(
  model: WorkshopModelDetail,
  settings: CinematicEditingSettings
) {
  const descriptor = cinematicEditingDescriptor(model)
  if (!descriptor) throw new WorkshopRouterError('unavailable')
  if (
    !(settings.sourceFile instanceof File) ||
    !settings.sourceFile.type.startsWith('image/')
  )
    throw new WorkshopRouterError('validation', null, { images: 'rejected' })
  if (!settings.prompt.trim())
    throw new WorkshopRouterError('validation', null, { prompt: 'rejected' })
  const schema = workshopPageSchema(model)
  const ratio = dimensions(settings.aspect)
  const exactSize =
    ratio &&
    descriptor.sizes.find((size) => {
      const shape = dimensions(size)
      return (
        shape &&
        Math.abs(shape.width / shape.height - ratio.width / ratio.height) < 0.01
      )
    })
  return {
    schema,
    values: mapRouterParameters(
      schema,
      defaultValues(schema),
      {
        prompt: settings.prompt.trim(),
        source_images: [settings.sourceFile],
        ...(settings.aspect && descriptor.aspects.length
          ? { aspect_ratio: settings.aspect }
          : {}),
        ...(settings.resolution && descriptor.resolutions.length
          ? { resolution: settings.resolution }
          : {}),
        ...(exactSize ? { model_specific: { size: exactSize } } : {})
      },
      routerParameterMappings(model.execution, model.modality)
    )
  }
}

export const cameraViewOptions = {
  azimuth: [
    { id: 'front', phrase: 'in front of the subject' },
    { id: 'front-right', phrase: 'at the subject’s front-right quarter' },
    {
      id: 'right',
      phrase: 'on the subject’s right side; show a right-side profile'
    },
    { id: 'back-right', phrase: 'at the subject’s back-right quarter' },
    {
      id: 'back',
      phrase: 'behind the subject; show the back of the head and shoulders'
    },
    { id: 'back-left', phrase: 'at the subject’s back-left quarter' },
    {
      id: 'left',
      phrase: 'on the subject’s left side; show a left-side profile'
    },
    { id: 'front-left', phrase: 'at the subject’s front-left quarter' }
  ],
  elevation: [
    {
      id: 'low',
      phrase: 'Look distinctly upward from below the subject’s eye line.'
    },
    { id: 'eye', phrase: 'Use an eye-level shot.' },
    { id: 'raised', phrase: 'Use an elevated shot.' },
    {
      id: 'high',
      phrase:
        'Look distinctly downward with visible top surfaces and foreshortening.'
    }
  ],
  distance: [
    {
      id: 'close',
      phrase:
        'Tight close-up: the face or focal detail fills most of the frame; crop away the full body and most of the room.'
    },
    {
      id: 'medium',
      phrase: 'Medium shot: show the upper body and immediate action.'
    },
    {
      id: 'wide',
      phrase:
        'Wide shot: move back, make the subject small in the frame and show more surroundings.'
    }
  ]
} as const

export interface CameraViewSettings {
  readonly azimuth: string
  readonly elevation: string
  readonly distance: string
}

export const cameraViewDefaults: CameraViewSettings = {
  azimuth: 'back-right',
  elevation: 'high',
  distance: 'medium'
}

function optionPhrase(
  options: readonly { readonly id: string; readonly phrase: string }[],
  id: string
): string {
  const option = options.find((candidate) => candidate.id === id)
  if (!option) throw new WorkshopRouterError('validation')
  return option.phrase
}

export function cameraViewPrompt(settings: CameraViewSettings): string {
  const azimuth = optionPhrase(cameraViewOptions.azimuth, settings.azimuth)
  const elevation = optionPhrase(
    cameraViewOptions.elevation,
    settings.elevation
  )
  const distance = optionPhrase(cameraViewOptions.distance, settings.distance)
  return `Create one new cinematic still of the same moment shown in image 1. Move the camera ${azimuth}. ${elevation} ${distance} Preserve the recognizable subject, clothing and action. Keep the subject’s position and orientation in the scene; move the camera, not just the person. Foreground and background should change perspective together. Objects or hands may fall outside a close-up. No captions, collage, duplicated body parts or extra people.`
}

const LOOK_PARTS: readonly DirectionPart[] = [
  'body',
  'lens',
  'aperture',
  'light',
  'film',
  'look',
  'grade'
]

export function cinematicLookPrompt(direction: Direction): string {
  const treatments = LOOK_PARTS.flatMap((part) => {
    const option = directionOption(part, direction)
    if (option.id !== direction[part])
      throw new WorkshopRouterError('validation')
    const phrase = option.phrase
    return phrase ? [phrase] : []
  })
  if (!treatments.length) throw new WorkshopRouterError('validation')
  return `Edit the supplied film still. Preserve its subject identity, clothing, pose, action, objects, camera position, framing and scene geometry. Change only these selected visual treatments: ${treatments.join('; ')}. Retain the source appearance for unspecified treatments. Keep one coherent image with no added text or extra people.`
}

export const cinematicRelightTypes = [
  { id: 'midday', phrase: 'midday light' },
  { id: 'blue-hour', phrase: 'blue hour light' },
  { id: 'golden-hour', phrase: 'low-angle sunlight' },
  { id: 'sunrise', phrase: 'sunrise light' },
  {
    id: 'spotlight',
    phrase: 'spotlight on the subject, keeping the background setting'
  },
  { id: 'overcast', phrase: 'soft overcast daylight' },
  { id: 'moonlight', phrase: 'moonlight' },
  {
    id: 'studio',
    phrase: 'harsh studio lighting, keeping the background setting'
  }
] as const

export const cinematicRelightDirections = [
  { id: 'auto', phrase: 'Choose a natural light direction.' },
  { id: 'front', phrase: 'Light from the front.' },
  { id: 'side', phrase: 'Light from the side.' },
  { id: 'bottom', phrase: 'Light from below.' },
  { id: 'top-down', phrase: 'Light from above.' }
] as const

export function cinematicRelightPrompt(
  type: string,
  direction: string
): string {
  const lighting = optionPhrase(cinematicRelightTypes, type)
  const position = optionPhrase(cinematicRelightDirections, direction)
  return `Relight the supplied film still with ${lighting}. ${position} Change only the illumination and its corresponding shadows. Preserve subject identity, clothing, pose, action, objects, camera position, framing and scene geometry. Keep one coherent image with no added text or extra people.`
}
