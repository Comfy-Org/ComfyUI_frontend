import type { RouterParameterName } from '../../../config/router-parameters'
import {
  createRouterParameters,
  routerParameterMappings
} from '../../../config/router-parameters'
import type { WorkshopContract } from '../../../config/workshop-contract'
import { formForContract } from '../../../config/workshop-contract'
import type { FieldSchema } from '../../../config/workshop-playground'
import {
  defaultValues,
  schemaForModel,
  urlUploadField
} from '../../../config/workshop-playground'
import { ASPECT_RATIOS } from './catalog'
import type { AspectRatio } from './catalog'

/*
 * What a video operation's Router contract lets a shot choose. Each setting is
 * found the way the shared Router mapping finds it when the request is sent, so
 * the studio only offers what will actually reach the model.
 */

export interface CinematicVideoCapabilities {
  /** Clip lengths in seconds, shortest first; empty when the model decides. */
  readonly durations: readonly number[]
  readonly defaultDuration?: number
  /** The model's own resolution values, e.g. `720p`, `fhd`, `1080P`. */
  readonly resolutions: readonly string[]
  readonly defaultResolution?: string
  /** Studio frames the model names; empty when it picks the shape itself. */
  readonly aspects: readonly AspectRatio[]
  /** The toggle that switches generated sound, when the model has one. */
  readonly audioField?: string
  /** How the model takes a starting image, when it takes one. */
  readonly firstFrame?: 'first_frame' | 'source_images'
  readonly firstFrameRequired: boolean
  readonly lastFrame: boolean
  /** Video to edit; an operation that has one requires it. */
  readonly sourceVideo: boolean
}

const STUDIO_DURATION = 5

function contractSchema(contract: WorkshopContract): readonly FieldSchema[] {
  return schemaForModel({ fields: [], form: formForContract(contract) })
}

/** The fields the shared mapping fills for a Router parameter. */
function fieldsFor(
  contract: WorkshopContract,
  schema: readonly FieldSchema[],
  parameter: RouterParameterName,
  sample: unknown
): readonly FieldSchema[] {
  const mappings = routerParameterMappings(contract, 'video')
  return schema.filter(
    (field) =>
      createRouterParameters(
        [field],
        defaultValues([field]),
        mappings
      ).router_get_closest_value(sample, parameter) !== undefined
  )
}

function durationsOf(field: FieldSchema | undefined): readonly number[] {
  if (!field) return []
  if (field.kind === 'select')
    return field.options
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0)
      .sort((a, b) => a - b)
  if (field.kind === 'number' && field.max !== undefined) {
    const from = Math.max(1, Math.ceil(field.min ?? 1))
    return Array.from(
      { length: Math.floor(field.max) - from + 1 },
      (_, index) => from + index
    )
  }
  return []
}

function nearest(values: readonly number[], target: number): number {
  return values.reduce((best, value) =>
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  )
}

const AUDIO_TOGGLE = /^(?:generate_?audio|audio|sound)$/i

/** The choices a video operation's contract offers a shot. */
export function videoCapabilities(
  contract: WorkshopContract
): CinematicVideoCapabilities {
  const schema = contractSchema(contract)
  const find = (parameter: RouterParameterName, sample: unknown) =>
    fieldsFor(contract, schema, parameter, sample)
  const durations = durationsOf(find('duration_seconds', STUDIO_DURATION).at(0))
  const resolution = find('resolution', '720p').find(
    (field) => field.kind === 'select'
  )
  const aspect = find('aspect_ratio', '16:9').find(
    (field) => field.kind === 'select'
  )
  const named = new Set(aspect?.kind === 'select' ? aspect.options : [])
  const media = (parameter: RouterParameterName, type = 'image/png') =>
    find(parameter, new File([], 'sample', { type })).filter(
      (field) => field.kind === 'file' || !!urlUploadField(field)
    )
  const first = media('first_frame').at(0)
  const source = first ? undefined : media('source_images').at(0)
  const start = first ?? source
  const audio = schema.find(
    (field) =>
      field.kind === 'toggle' &&
      AUDIO_TOGGLE.test(field.name.replace(/^(param_|setting_)/, ''))
  )
  return {
    durations,
    ...(durations.length
      ? { defaultDuration: nearest(durations, STUDIO_DURATION) }
      : {}),
    resolutions:
      resolution?.kind === 'select' ? resolution.options.map(String) : [],
    ...(resolution?.defaultValue !== undefined
      ? { defaultResolution: String(resolution.defaultValue) }
      : {}),
    aspects: ASPECT_RATIOS.map(({ id }) => id).filter((id) => named.has(id)),
    ...(audio ? { audioField: audio.name } : {}),
    ...(start
      ? {
          firstFrame: first
            ? ('first_frame' as const)
            : ('source_images' as const)
        }
      : {}),
    firstFrameRequired: !!start?.required,
    lastFrame: media('last_frame').length > 0,
    sourceVideo: media('source_videos', 'video/mp4').some(
      (field) => field.required
    )
  }
}

/** How a resolution value reads in the studio: `fhd` is 1080p, `4k` is 4K. */
export function resolutionLabel(value: string): string {
  const lower = value.toLowerCase()
  if (lower === 'hd') return '720p'
  if (lower === 'fhd') return '1080p'
  if (lower === 'sd') return '480p'
  return /^\d+k$/.test(lower) ? lower.toUpperCase() : lower
}

/** The sharpest resolution a model offers, for the model picker. */
export function topResolution(
  capabilities: CinematicVideoCapabilities
): string | undefined {
  const pixels = (value: string) => {
    const label = resolutionLabel(value)
    const k = /^(\d+)K$/.exec(label)
    return k ? Number(k[1]) * 1000 : Number.parseInt(label, 10) || 0
  }
  const [top] = [...capabilities.resolutions].sort(
    (a, b) => pixels(b) - pixels(a)
  )
  return top && resolutionLabel(top)
}

/** `4–30s` for a range, `4s` for a single length. */
export function durationRange(
  capabilities: CinematicVideoCapabilities
): string | undefined {
  const first = capabilities.durations.at(0)
  const last = capabilities.durations.at(-1)
  if (first === undefined) return undefined
  return first === last ? `${first}s` : `${first}–${last}s`
}
