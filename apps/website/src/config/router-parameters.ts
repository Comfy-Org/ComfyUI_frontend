import type { Dimensions } from './router-parameter-options'
import {
  closestNumber,
  closestOption,
  dimensions,
  numericValue
} from './router-parameter-options'
import type { RouterMedia } from './router-media'
import { routerMediaValue } from './router-media'
import type { WorkshopContract } from './workshop-contract'
import type { WorkshopModelDetail } from './models-catalogue'
import type { FieldSchema, FieldValue, FormValues } from './workshop-playground'
import { urlUploadField, validateForm } from './workshop-playground'
import { WorkshopRouterError } from './workshop-router-errors'

type Scalar = string | number | boolean

export interface RouterRenderParameters {
  readonly prompt?: string
  readonly negative_prompt?: string
  readonly seed?: number
  readonly size?: string | Dimensions
  readonly aspect_ratio?: string
  readonly resolution?: string | number
  readonly duration_seconds?: number
  readonly source_images?: readonly RouterMedia[]
  readonly source_videos?: readonly RouterMedia[]
  readonly source_audio?: readonly RouterMedia[]
  readonly reference_images?: readonly RouterMedia[]
  readonly reference_videos?: readonly RouterMedia[]
  readonly reference_audio?: readonly RouterMedia[]
  readonly first_frame?: RouterMedia
  readonly last_frame?: RouterMedia
  readonly mask_image?: RouterMedia
  readonly output_format?: string
  readonly quality?: number | string
  readonly style?: string
  readonly guidance?: number
  readonly steps?: number
  readonly generate_audio?: boolean
  readonly model_specific?: Readonly<Record<string, unknown>>
}

export type RouterParameterName = Exclude<
  keyof RouterRenderParameters,
  'model_specific'
>

export interface RouterParameterMapping {
  readonly parameter: RouterParameterName
  readonly component?: keyof Dimensions
  readonly index?: number
  readonly options?: Readonly<Record<string, Scalar>>
  readonly frames?: readonly ('first_frame' | 'last_frame')[]
}

export type RouterParameterMappings = Readonly<
  Partial<Record<string, RouterParameterMapping>>
>

const aliases: Readonly<Partial<Record<string, RouterParameterName>>> = {
  prompt: 'prompt',
  Prompt: 'prompt',
  prompt_text: 'prompt',
  text_prompt: 'prompt',
  promptText: 'prompt',
  text: 'prompt',
  input: 'prompt',
  inputs: 'prompt',
  negative_prompt: 'negative_prompt',
  negativePrompt: 'negative_prompt',
  seed: 'seed',
  size: 'size',
  imageSize: 'resolution',
  aspect_ratio: 'aspect_ratio',
  aspectRatio: 'aspect_ratio',
  ratio: 'aspect_ratio',
  resolution: 'resolution',
  target_resolution: 'resolution',
  max_resolution: 'resolution',
  duration: 'duration_seconds',
  duration_seconds: 'duration_seconds',
  durationSeconds: 'duration_seconds',
  quality: 'quality',
  rendering_speed: 'quality',
  style: 'style',
  guidance: 'guidance',
  guidance_scale: 'guidance',
  cfg_scale: 'guidance',
  steps: 'steps',
  steps_num: 'steps',
  output_format: 'output_format',
  generate_audio: 'generate_audio',
  generateAudio: 'generate_audio',
  sound: 'generate_audio',
  image: 'source_images',
  image_url: 'source_images',
  input_image: 'source_images',
  media_image: 'source_images',
  person: 'source_images',
  images: 'source_images',
  video: 'source_videos',
  video_url: 'source_videos',
  input_video: 'source_videos',
  source_uri: 'source_images',
  videoUri: 'source_videos',
  start_video: 'source_videos',
  audio_url: 'source_audio',
  reference_images: 'reference_images',
  media_reference_image: 'reference_images',
  reference_image_uri: 'reference_images',
  garment: 'reference_images',
  background_url: 'reference_images',
  reference_videos: 'reference_videos',
  reference_audio: 'reference_audio',
  first_frame: 'first_frame',
  first_frame_url: 'first_frame',
  last_frame: 'last_frame',
  last_frame_url: 'last_frame',
  image_tail: 'last_frame',
  mask: 'mask_image',
  mask_url: 'mask_image',
  static_mask: 'mask_image',
  media_mask: 'mask_image'
}

const mediaParameters = new Set<RouterParameterName>([
  'source_images',
  'source_videos',
  'source_audio',
  'reference_images',
  'reference_videos',
  'reference_audio',
  'first_frame',
  'last_frame',
  'mask_image'
])

export function routerParameterMappings(
  contract: WorkshopContract | undefined,
  modality?: WorkshopModelDetail['modality']
): RouterParameterMappings {
  if (
    contract?.inputs?.source_uri &&
    (modality === 'image' || modality === 'video')
  )
    return {
      source_uri: {
        parameter: modality === 'video' ? 'source_videos' : 'source_images'
      }
    }
  const creator = contract?.creator
  if (creator?.request.kind !== 'callback') return {}
  if (
    creator.request.callback === 'runway-image' &&
    creator.request.options.mode === 'first-frame'
  )
    return { images: { parameter: 'first_frame' } }
  if (
    creator.request.callback === 'bfl-video' &&
    creator.fixedValues?.mode === 'i2v'
  )
    return {
      images: {
        parameter: 'source_images',
        frames: ['first_frame', 'last_frame']
      }
    }
  return {}
}

function rejected(name: string): never {
  throw new WorkshopRouterError('validation', null, { [name]: 'rejected' })
}

function selectionMapping(
  field: Extract<FieldSchema, { kind: 'select' }>,
  name: string
): RouterParameterMapping | undefined {
  if (
    name === 'mode' &&
    field.options.every((value) => value === 'std' || value === 'pro')
  )
    return { parameter: 'quality' }
  if (name === 'sound')
    return { parameter: 'generate_audio', options: { on: true, off: false } }
  if (['size', 'resolution', 'imageSize'].includes(name)) {
    const sizes = field.options.flatMap((value) => dimensions(value) ?? [])
    if (sizes.length)
      return {
        parameter: sizes.every((size) => size.width < 100 && size.height < 100)
          ? 'aspect_ratio'
          : 'size'
      }
    return { parameter: 'resolution' }
  }
  return undefined
}

function mappingFor(
  field: FieldSchema,
  mappings: RouterParameterMappings
): RouterParameterMapping | undefined {
  if (Object.hasOwn(mappings, field.name)) return mappings[field.name]
  const name = field.name.replace(
    /^(param_|setting_|config_|image_)(?=[A-Za-z])/,
    ''
  )
  if (name === 'width' || name === 'height')
    return { parameter: 'size', component: name }
  if (field.kind === 'select') {
    const selection = selectionMapping(field, name)
    if (selection) return selection
  }
  const reference = /^reference_image_url(?:_(\d+))?$/.exec(field.name)
  if (reference)
    return {
      parameter: 'reference_images',
      index: Number(reference.at(1) ?? 1) - 1
    }
  const source = /^(?:input_image|image_url)_(\d+)$/.exec(field.name)
  if (source)
    return { parameter: 'source_images', index: Number(source[1]) - 1 }
  const parameter = aliases[field.name] ?? aliases[name]
  if (!parameter) return
  return { parameter }
}

function structuredPrompt(
  field: FieldSchema,
  input: unknown,
  initial: FieldValue
): string {
  if (typeof input !== 'string' || typeof initial !== 'string')
    return rejected(field.name)
  let value: unknown
  try {
    value = JSON.parse(initial)
  } catch {
    return rejected(field.name)
  }
  if (Array.isArray(value)) {
    const first: unknown = value.at(0)
    if (
      first &&
      typeof first === 'object' &&
      'voice_id' in first &&
      typeof first.voice_id === 'string'
    )
      return JSON.stringify([{ text: input, voice_id: first.voice_id }])
  }
  if (value && typeof value === 'object' && 'high_level_description' in value)
    return JSON.stringify({ high_level_description: input })
  return typeof value === 'string'
    ? JSON.stringify(input)
    : rejected(field.name)
}

function mediaInput(
  field: FieldSchema,
  input: unknown,
  mapping: RouterParameterMapping
): FieldValue {
  if (Array.isArray(input) && mapping.index !== undefined)
    input = input[mapping.index]
  else if (Array.isArray(input) && !(field.kind === 'file' && field.multiple))
    input = input[0]
  else if (
    Array.isArray(input) &&
    field.kind === 'file' &&
    field.maxItems !== undefined
  )
    input = input.slice(0, field.maxItems)
  return input === undefined ? undefined : routerMediaValue(field, input)
}

function closest(
  field: FieldSchema,
  input: unknown,
  mapping: RouterParameterMapping,
  initial?: FieldValue
): FieldValue {
  if (
    field.kind === 'text' &&
    field.valueType === 'json' &&
    mapping.parameter === 'prompt'
  )
    return structuredPrompt(field, input, initial)
  const size = dimensions(input)
  const value = mapping.component
    ? (size?.[mapping.component] ?? rejected(field.name))
    : input
  if (mediaParameters.has(mapping.parameter))
    return mediaInput(field, value, mapping)
  if (field.kind === 'select') return closestOption(field, value, mapping)
  if (field.kind === 'number')
    return closestNumber(field, value, mapping.parameter)
  if (field.kind === 'text' && size) {
    if (mapping.parameter === 'size') return `${size.width}x${size.height}`
    if (mapping.parameter === 'aspect_ratio')
      return `${size.width}:${size.height}`
  }
  return strictValue(field, value)
}

function strictValue(field: FieldSchema, value: unknown): FieldValue {
  if (value === undefined) return undefined
  if (
    field.kind === 'file' ||
    (urlUploadField(field) && typeof value === 'object')
  )
    return routerMediaValue(field, value)
  if (field.kind === 'text' && field.valueType === 'json') {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value)
    } catch {
      return rejected(field.name)
    }
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return value
  return rejected(field.name)
}

interface ParameterContext {
  readonly schema: readonly FieldSchema[]
  readonly defaults: FormValues
  readonly mappings: RouterParameterMappings
}

function frameInputs(
  frames: NonNullable<RouterParameterMapping['frames']>,
  parameters: RouterRenderParameters,
  initial: FieldValue
) {
  const previous = Array.isArray(initial) ? initial : [initial]
  return frames.flatMap(
    (role, index) =>
      parameters[role] ??
      parameters.source_images?.[index] ??
      previous[index] ??
      []
  )
}

function hasSeparateReferences(
  schema: readonly FieldSchema[],
  mappings: RouterParameterMappings
) {
  return schema.some(
    (field) => mappingFor(field, mappings)?.parameter === 'reference_images'
  )
}

function sourceImageInputs(
  parameters: RouterRenderParameters,
  separateReferences: boolean
) {
  const sources =
    parameters.first_frame !== undefined
      ? [parameters.first_frame, ...(parameters.source_images?.slice(1) ?? [])]
      : parameters.source_images
  const references = separateReferences
    ? undefined
    : parameters.reference_images
  return sources || references
    ? [...(sources ?? []), ...(references ?? [])]
    : undefined
}

function sizeLimits(shape: Dimensions, context: ParameterContext) {
  return context.schema.flatMap((field) => {
    const component = mappingFor(field, context.mappings)?.component
    return component && field.kind === 'number'
      ? [
          {
            min: (field.min ?? 0) / shape[component],
            max: (field.max ?? Infinity) / shape[component]
          }
        ]
      : []
  })
}

function sizeInput(
  field: FieldSchema,
  mapping: RouterParameterMapping,
  parameters: RouterRenderParameters,
  context: ParameterContext
): Dimensions | undefined {
  const ratio = dimensions(parameters.aspect_ratio)
  const resolution = numericValue(parameters.resolution, 'resolution', false)
  if (!ratio && resolution === undefined) return
  const { defaults } = context
  const initial = dimensions(defaults[field.name]) ?? {
    width: typeof defaults.width === 'number' ? defaults.width : 1024,
    height: typeof defaults.height === 'number' ? defaults.height : 1024
  }
  const shape = ratio ?? initial
  const pixels = resolution ?? Math.min(initial.width, initial.height)
  const limits = mapping.component ? sizeLimits(shape, context) : []
  const scale = Math.min(
    Math.max(
      pixels / Math.min(shape.width, shape.height),
      ...limits.map((limit) => limit.min)
    ),
    ...limits.map((limit) => limit.max)
  )
  return { width: shape.width * scale, height: shape.height * scale }
}

function parameterInput(
  field: FieldSchema,
  mapping: RouterParameterMapping,
  parameters: RouterRenderParameters,
  context: ParameterContext
): unknown {
  if (mapping.frames?.some((role) => parameters[role] !== undefined))
    return frameInputs(mapping.frames, parameters, context.defaults[field.name])
  if (mapping.parameter === 'source_images' && field.name !== 'source_uri') {
    const images = sourceImageInputs(
      parameters,
      hasSeparateReferences(context.schema, context.mappings)
    )
    if (images) return images
  }
  const input = parameters[mapping.parameter]
  if (input !== undefined) return input
  if (mapping.parameter === 'size') {
    const size = sizeInput(field, mapping, parameters, context)
    if (size) return size
  }
  if (field.name === 'source_uri') return parameters.source_videos
  if (field.name === 'background_url') return parameters.reference_videos
  if (mapping.parameter === 'first_frame') return parameters.source_images?.[0]
  return ['aspect_ratio', 'resolution'].includes(mapping.parameter)
    ? parameters.size
    : undefined
}

function parameterNames(
  field: FieldSchema,
  mapping: RouterParameterMapping,
  schema: readonly FieldSchema[],
  mappings: RouterParameterMappings
): readonly RouterParameterName[] {
  if (mapping.parameter === 'size')
    return ['size', 'aspect_ratio', 'resolution']
  if (
    mapping.parameter === 'aspect_ratio' ||
    mapping.parameter === 'resolution'
  )
    return [mapping.parameter, 'size']
  if (mapping.parameter === 'source_images' && field.name !== 'source_uri') {
    const separateReferences = hasSeparateReferences(schema, mappings)
    const references: readonly RouterParameterName[] = separateReferences
      ? []
      : ['reference_images']
    return [
      'source_images',
      'first_frame',
      ...(mapping.frames ?? []),
      ...references
    ]
  }
  if (mapping.parameter === 'first_frame')
    return ['first_frame', 'source_images']
  if (field.name === 'background_url')
    return ['reference_images', 'reference_videos']
  if (field.name === 'source_uri' && !Object.hasOwn(mappings, field.name))
    return ['source_images', 'source_videos']
  return [mapping.parameter]
}

export function mapRouterParameters(
  schema: readonly FieldSchema[],
  defaults: FormValues,
  parameters: RouterRenderParameters,
  mappings: RouterParameterMappings = {}
): FormValues {
  const supported = new Set<string>([
    ...Object.values(aliases).filter((name) => name !== undefined),
    'model_specific'
  ])
  for (const name of Object.keys(parameters))
    if (!supported.has(name)) rejected(name)
  const values = { ...defaults }
  for (const field of schema) {
    const mapping = mappingFor(field, mappings)
    if (!mapping) continue
    if (
      !parameterNames(field, mapping, schema, mappings).some(
        (name) => parameters[name] !== undefined
      )
    )
      continue
    const input = parameterInput(field, mapping, parameters, {
      schema,
      defaults,
      mappings
    })
    if (input !== undefined)
      values[field.name] = closest(field, input, mapping, defaults[field.name])
  }
  for (const [name, value] of Object.entries(parameters.model_specific ?? {})) {
    const field = schema.find((candidate) => candidate.name === name)
    if (!field) rejected(name)
    values[name] = strictValue(field, value)
  }
  const errors = validateForm(schema, values)
  if (Object.keys(errors).length)
    throw new WorkshopRouterError('validation', null, errors)
  return values
}

export function createRouterParameters(
  schema: readonly FieldSchema[],
  defaults: FormValues,
  mappings: RouterParameterMappings = {}
) {
  function fieldsFor(name: RouterParameterName) {
    return schema.flatMap((field) => {
      const mapping = mappingFor(field, mappings)
      return mapping &&
        parameterNames(field, mapping, schema, mappings).includes(name)
        ? [{ field, mapping }]
        : []
    })
  }
  function combined(
    entries: readonly {
      field: FieldSchema
      mapping: RouterParameterMapping
      value: FieldValue
    }[]
  ) {
    if (entries.length > 1 && entries.every((entry) => entry.mapping.component))
      return Object.fromEntries(
        entries.map((entry) => [entry.mapping.component, entry.value])
      )
    if (
      entries.length > 1 &&
      entries.every((entry) =>
        ['aspect_ratio', 'resolution'].includes(entry.mapping.parameter)
      )
    )
      return Object.fromEntries(
        entries.map((entry) => [entry.mapping.parameter, entry.value])
      )
    if (
      entries.length > 1 &&
      entries.every((entry) => mediaParameters.has(entry.mapping.parameter))
    )
      return entries.flatMap((entry) => entry.value ?? [])
    return entries[0]?.value
  }
  return {
    router_get_closest_value(input: unknown, arg_name: RouterParameterName) {
      return combined(
        fieldsFor(arg_name).map(({ field, mapping }) => ({
          field,
          mapping,
          value: closest(
            field,
            parameterInput(
              field,
              mapping,
              { [arg_name]: input },
              { schema, defaults, mappings }
            ),
            mapping,
            defaults[field.name]
          )
        }))
      )
    },
    router_get_default_value(arg_name: RouterParameterName) {
      return combined(
        fieldsFor(arg_name).map(({ field, mapping }) => ({
          field,
          mapping,
          value: defaults[field.name]
        }))
      )
    },
    resolve(parameters: RouterRenderParameters) {
      return mapRouterParameters(schema, defaults, parameters, mappings)
    }
  }
}
