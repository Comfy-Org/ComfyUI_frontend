import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { RouterRenderParameters } from '../../../config/router-parameters'
import {
  mapRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import type { WorkshopContract } from '../../../config/workshop-contract'
import { workshopPageSchema } from '../../../config/workshop-page-state'
import { defaultValues } from '../../../config/workshop-playground'

export interface CinematicVideoSettings {
  readonly durationSeconds: number
  readonly resolution: string
  readonly generateAudio: boolean
  readonly firstFrame?: File
  readonly lastFrame?: File
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
  const properties = object(parameters?.properties)
  const durations = options(properties.duration).filter(
    (value): value is number => typeof value === 'number' && value > 0
  )
  const resolutions = options(properties.resolution).filter(
    (value): value is string => typeof value === 'string'
  )
  if (!durations.length || !resolutions.length) return
  const required = parameters?.required
  const duration = object(properties.duration).default
  const resolution = object(properties.resolution).default
  return {
    durations,
    resolutions,
    aspects: options(properties.ratio).filter(
      (value): value is string =>
        typeof value === 'string' && value !== 'adaptive'
    ),
    defaultDuration:
      typeof duration === 'number' && duration > 0 ? duration : durations[0],
    defaultResolution:
      typeof resolution === 'string' ? resolution : resolutions[0],
    firstFrame: !properties.first_frame_url
      ? 'unsupported'
      : Array.isArray(required) && required.includes('first_frame_url')
        ? 'required'
        : 'optional',
    lastFrame: Boolean(properties.last_frame_url),
    generateAudio: Boolean(properties.generate_audio)
  }
}

export function cinematicVideoForm(
  model: WorkshopModelDetail,
  prompt: string,
  aspect: string,
  settings: CinematicVideoSettings
) {
  const schema = workshopPageSchema(model)
  const parameters: RouterRenderParameters = {
    prompt,
    aspect_ratio: aspect,
    resolution: settings.resolution,
    duration_seconds: settings.durationSeconds,
    generate_audio: settings.generateAudio,
    ...(settings.firstFrame ? { first_frame: settings.firstFrame } : {}),
    ...(settings.lastFrame ? { last_frame: settings.lastFrame } : {})
  }
  return {
    schema,
    values: mapRouterParameters(
      schema,
      defaultValues(schema),
      parameters,
      model.execution
        ? routerParameterMappings(model.execution, model.modality)
        : {}
    )
  }
}
