import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import { dimensions } from '../../../config/router-parameter-options'
import type { RouterRenderParameters } from '../../../config/router-parameters'
import {
  mapRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import type { WorkshopContract } from '../../../config/workshop-contract'
import { workshopPageSchema } from '../../../config/workshop-page-state'
import { defaultValues } from '../../../config/workshop-playground'
import { WorkshopRouterError } from '../../../config/workshop-router-errors'

export interface CinematicVideoSettings {
  readonly durationSeconds: number
  readonly resolution: string
  readonly generateAudio: boolean
  readonly firstFrame?: File
  readonly lastFrame?: File
  readonly seed?: number
}

export interface CinematicVideoDescriptor {
  readonly durations: readonly number[]
  readonly resolutions: readonly string[]
  readonly aspects: readonly string[]
  readonly defaultDuration: number
  readonly defaultResolution: string
  readonly firstFrame: 'unsupported' | 'optional' | 'required'
  readonly lastFrame: boolean
  readonly generateAudio: boolean
  readonly resolutionField?: string
  readonly seed?: { readonly minimum: number; readonly maximum: number }
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

function options(value: unknown): readonly unknown[] {
  const values = object(value).enum
  return Array.isArray(values) ? values : []
}

export function cinematicVideoDescriptor(
  contract: WorkshopContract
): CinematicVideoDescriptor | undefined {
  const parameters = contract.creator?.parameters
  const original = object(parameters?.properties)
  const properties = Object.fromEntries(
    Object.entries(original).map(([key, value]) => [
      key.replace(/^param_/, ''),
      value
    ])
  )
  const request = contract.creator?.request
  if (
    request?.kind === 'callback' &&
    request.callback === 'wan-media' &&
    !['text', 'image'].includes(String(request.options.mode))
  )
    return
  const durations = options(properties.duration).filter(
    (value): value is number => typeof value === 'number' && value > 0
  )
  const resolutionField = Object.keys(original).find((name) =>
    ['resolution', 'param_resolution', 'param_size'].includes(name)
  )
  const resolutionProperty = resolutionField
    ? original[resolutionField]
    : undefined
  const resolutions = options(resolutionProperty).filter(
    (value): value is string => typeof value === 'string'
  )
  if (!durations.length || !resolutions.length) return
  const required = parameters?.required
  const duration = object(properties.duration).default
  const resolution = object(resolutionProperty).default
  const sourceField = properties.first_frame_url
    ? 'first_frame_url'
    : properties.image_url
      ? 'image_url'
      : undefined
  const declaredAspects = options(
    properties.ratio ?? properties.aspect_ratio
  ).filter(
    (value): value is string =>
      typeof value === 'string' && value !== 'adaptive'
  )
  const seed = object(properties.seed)
  const aspectFor = (value: string) => {
    const size = dimensions(value)
    if (!size) return []
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
    const divisor = gcd(size.width, size.height)
    return [`${size.width / divisor}:${size.height / divisor}`]
  }
  return {
    durations,
    resolutions,
    aspects: declaredAspects.length
      ? declaredAspects
      : [...new Set(resolutions.flatMap(aspectFor))],
    defaultDuration:
      typeof duration === 'number' && duration > 0 ? duration : durations[0],
    defaultResolution:
      typeof resolution === 'string' ? resolution : resolutions[0],
    firstFrame: !sourceField
      ? 'unsupported'
      : Array.isArray(required) && required.includes(sourceField)
        ? 'required'
        : 'optional',
    lastFrame: Boolean(properties.last_frame_url),
    generateAudio: Boolean(properties.generate_audio),
    ...(resolutionField ? { resolutionField } : {}),
    ...(typeof seed.minimum === 'number' && typeof seed.maximum === 'number'
      ? { seed: { minimum: seed.minimum, maximum: seed.maximum } }
      : {})
  }
}

export function videoResolutionsForAspect(
  descriptor: CinematicVideoDescriptor,
  aspect: string
): readonly string[] {
  const ratio = dimensions(aspect)
  return descriptor.resolutions.filter((value) => {
    const size = dimensions(value)
    return (
      !size ||
      !ratio ||
      Math.abs(size.width / size.height - ratio.width / ratio.height) < 0.001
    )
  })
}

export function cinematicVideoForm(
  model: WorkshopModelDetail,
  prompt: string,
  aspect: string,
  settings: CinematicVideoSettings
) {
  const descriptor =
    model.execution && cinematicVideoDescriptor(model.execution)
  if (!descriptor) throw new WorkshopRouterError('unavailable')
  if (
    !descriptor.durations.includes(settings.durationSeconds) ||
    !descriptor.resolutions.includes(settings.resolution)
  )
    throw new WorkshopRouterError('validation')
  if (
    (settings.firstFrame && descriptor.firstFrame === 'unsupported') ||
    (settings.lastFrame && !descriptor.lastFrame)
  )
    throw new WorkshopRouterError('validation')
  if (
    settings.seed !== undefined &&
    (!descriptor.seed ||
      !Number.isInteger(settings.seed) ||
      settings.seed < descriptor.seed.minimum ||
      settings.seed > descriptor.seed.maximum)
  )
    throw new WorkshopRouterError('validation')
  if (descriptor.aspects.length && !descriptor.aspects.includes(aspect))
    throw new WorkshopRouterError('validation')
  const supportedResolutions = videoResolutionsForAspect(descriptor, aspect)
  const nativeResolution = supportedResolutions.includes(settings.resolution)
    ? settings.resolution
    : supportedResolutions.find((value) => {
        const selected = dimensions(settings.resolution)
        const candidate = dimensions(value)
        return (
          selected &&
          candidate &&
          selected.width * selected.height ===
            candidate.width * candidate.height
        )
      })
  if (!nativeResolution) throw new WorkshopRouterError('validation')
  const schema = workshopPageSchema(model)
  const parameters: RouterRenderParameters = {
    prompt,
    ...(descriptor.aspects.length ? { aspect_ratio: aspect } : {}),
    ...(dimensions(nativeResolution)
      ? {
          model_specific: {
            [descriptor.resolutionField ?? 'resolution']: nativeResolution
          }
        }
      : { resolution: nativeResolution }),
    duration_seconds: settings.durationSeconds,
    ...(descriptor.generateAudio
      ? { generate_audio: settings.generateAudio }
      : {}),
    ...(settings.seed !== undefined ? { seed: settings.seed } : {}),
    ...(settings.firstFrame ? { first_frame: settings.firstFrame } : {}),
    ...(settings.lastFrame ? { last_frame: settings.lastFrame } : {})
  }
  return {
    schema,
    values: mapRouterParameters(
      schema,
      defaultValues(schema),
      parameters,
      routerParameterMappings(model.execution, model.modality)
    )
  }
}
