import type { FieldSchema } from './workshop-playground'
import type {
  RouterParameterMapping,
  RouterParameterName
} from './router-parameters'
import { WorkshopRouterError } from './workshop-router-errors'

type Scalar = string | number | boolean
type NumberField = Extract<FieldSchema, { kind: 'number' }>
export interface Dimensions {
  readonly width: number
  readonly height: number
}

function rejected(name: string): never {
  throw new WorkshopRouterError('validation', null, { [name]: 'rejected' })
}

const qualityValues: Readonly<Partial<Record<string, number>>> = {
  very_low: 0,
  low: 0.25,
  medium: 0.5,
  standard: 0.5,
  std: 0.5,
  default: 0.5,
  turbo: 0,
  high: 1,
  hd: 1,
  pro: 1,
  quality: 1
}

export function dimensions(value: unknown): Dimensions | undefined {
  if (typeof value === 'string') {
    const match = /^(\d+(?:\.\d+)?)\s*[x×*:]\s*(\d+(?:\.\d+)?)$/i.exec(
      value.trim()
    )
    if (match)
      return dimensions({ width: Number(match[1]), height: Number(match[2]) })
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'width' in value &&
    'height' in value &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    Number.isFinite(value.width) &&
    Number.isFinite(value.height) &&
    value.width > 0 &&
    value.height > 0
  )
    return { width: value.width, height: value.height }
  return undefined
}

function resolutionValue(
  text: string,
  videoResolution: boolean
): number | undefined {
  if (text === 'hd') return 720
  if (text === 'fhd') return 1080
  const pixels = /^(\d+(?:\.\d+)?)(p|k)?$/.exec(text)
  if (!pixels) return
  const amount = Number(pixels[1])
  return pixels[2] === 'k' ? amount * (videoResolution ? 540 : 1024) : amount
}

export function numericValue(
  value: unknown,
  parameter: RouterParameterName,
  videoResolution: boolean
): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return
  const text = value.toLowerCase().trim()
  if (parameter === 'quality') return qualityValues[text]
  if (parameter === 'duration_seconds') {
    const duration = /^(\d+(?:\.\d+)?)\s*(?:s|seconds?)?$/.exec(text)
    return duration ? Number(duration[1]) : undefined
  }
  if (parameter === 'resolution' || parameter === 'size') {
    const resolution = resolutionValue(text, videoResolution)
    if (resolution !== undefined) return resolution
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return
  return Number(text)
}

function optionDistance(
  input: unknown,
  option: Scalar,
  mapping: RouterParameterMapping,
  videoResolution: boolean
): number {
  const target = mapping.options?.[String(option)] ?? option
  const inputSize = dimensions(input)
  const optionSize = dimensions(target)
  if (inputSize && optionSize) {
    const ratio = Math.log(
      optionSize.width /
        optionSize.height /
        (inputSize.width / inputSize.height)
    )
    if (mapping.parameter === 'aspect_ratio' || optionSize.width < 100)
      return Math.abs(ratio)
    return Math.hypot(
      Math.log(optionSize.width / inputSize.width),
      Math.log(optionSize.height / inputSize.height)
    )
  }
  const left = inputSize
    ? videoResolution
      ? Math.min(inputSize.width, inputSize.height)
      : Math.max(inputSize.width, inputSize.height)
    : numericValue(input, mapping.parameter, videoResolution)
  const right = optionSize
    ? Math.min(optionSize.width, optionSize.height)
    : numericValue(target, mapping.parameter, videoResolution)
  if (
    mapping.parameter === 'duration_seconds' &&
    right !== undefined &&
    right <= 0
  )
    return Infinity
  return left === undefined || right === undefined
    ? Infinity
    : Math.abs(left - right)
}

export function closestOption(
  field: Extract<FieldSchema, { kind: 'select' }>,
  input: unknown,
  mapping: RouterParameterMapping
): Scalar {
  const exact = field.options.find(
    (option) =>
      mapping.options?.[String(option)] === input ||
      String(option).toLowerCase() === String(input).toLowerCase()
  )
  if (exact !== undefined) return exact
  const videoResolution = field.options.some(
    (option) => typeof option === 'string' && /^(\d+p|f?hd)$/i.test(option)
  )
  const nearest = field.options.reduce<
    { option: Scalar; distance: number } | undefined
  >((best, option) => {
    const distance = optionDistance(input, option, mapping, videoResolution)
    return !best || distance < best.distance ? { option, distance } : best
  }, undefined)
  return nearest && Number.isFinite(nearest.distance)
    ? nearest.option
    : rejected(field.name)
}

function stepFor(field: NumberField): number | 'any' {
  if (typeof field.inputSchema?.multipleOf === 'number')
    return field.inputSchema.multipleOf
  if (field.inputSchema?.type === 'integer') return 1
  return field.inputSchema ? 'any' : field.step
}

export function snapToStep(value: number, field: NumberField): number {
  const step = stepFor(field)
  if (step === 'any' || !(step > 0))
    return Math.max(
      field.min ?? -Infinity,
      Math.min(field.max ?? Infinity, value)
    )
  const origin = field.inputSchema ? 0 : (field.min ?? 0)
  const low =
    field.min === undefined ? -Infinity : Math.ceil((field.min - origin) / step)
  const high =
    field.max === undefined ? Infinity : Math.floor((field.max - origin) / step)
  const snapped =
    origin +
    Math.max(low, Math.min(high, Math.round((value - origin) / step))) * step
  return Number(snapped.toPrecision(15))
}

export function closestNumber(
  field: NumberField,
  input: unknown,
  parameter: RouterParameterName
): number {
  const value = numericValue(input, parameter, false)
  if (value === undefined) return rejected(field.name)
  const scaled =
    parameter === 'quality' &&
    typeof input === 'number' &&
    field.min !== undefined &&
    field.max !== undefined
      ? field.min + Math.max(0, Math.min(1, value)) * (field.max - field.min)
      : value
  return snapToStep(scaled, field)
}
