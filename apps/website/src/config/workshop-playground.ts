import { t } from '../i18n/translations'
import type {
  GeneratedExample,
  GeneratedField,
  Modality,
  WorkshopModelDetail
} from './workshop'

export type FieldSchema =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly placeholder?: string
      readonly required: boolean
      readonly multiline: boolean
    }
  | {
      readonly kind: 'select'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly string[]
      readonly defaultValue: string
    }
  | {
      readonly kind: 'number'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly defaultValue: number
    }
  | {
      readonly kind: 'toggle'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly defaultValue: boolean
    }
  | {
      readonly kind: 'file'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly accept: readonly string[]
      readonly maxBytes: number
      readonly required: boolean
    }

interface FileValue {
  readonly name: string
  readonly size: number
  readonly type: string
}

export type FieldValue = string | number | boolean | FileValue | undefined
export type FormValues = Readonly<Record<string, FieldValue>>
export type FieldErrorCode =
  | 'required'
  | 'tooLarge'
  | 'badType'
  | 'outOfRange'
  | 'badOption'
  | 'rejected'
export type FieldErrors = Readonly<Record<string, FieldErrorCode>>

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const ACCEPT: Record<'image' | 'video' | 'audio', readonly string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4']
}

function fromGenerated(field: GeneratedField): FieldSchema {
  switch (field.kind) {
    case 'text':
      return {
        kind: 'text',
        name: field.name,
        label: field.label,
        ...(field.hint ? { hint: field.hint } : {}),
        required: field.required,
        multiline: field.multiline
      }
    case 'number':
      return {
        kind: 'number',
        name: field.name,
        label: field.label,
        ...(field.hint ? { hint: field.hint } : {}),
        min: field.min,
        max: field.max,
        step: field.step,
        defaultValue: field.default
      }
    case 'select':
      return {
        kind: 'select',
        name: field.name,
        label: field.label,
        ...(field.hint ? { hint: field.hint } : {}),
        options: field.options,
        defaultValue: field.default
      }
    case 'toggle':
      return {
        kind: 'toggle',
        name: field.name,
        label: field.label,
        ...(field.hint ? { hint: field.hint } : {}),
        defaultValue: field.default
      }
    case 'file':
      return {
        kind: 'file',
        name: field.name,
        label: field.label,
        ...(field.hint ? { hint: field.hint } : {}),
        accept: ACCEPT[field.accept],
        maxBytes: MAX_UPLOAD_BYTES,
        required: field.required
      }
  }
}

const prompt: FieldSchema = {
  kind: 'text',
  name: 'prompt',
  label: t('workshop.field.prompt'),
  placeholder: t('workshop.field.promptPlaceholder'),
  required: true,
  multiline: true
}

const seed: FieldSchema = {
  kind: 'number',
  name: 'seed',
  label: t('workshop.field.seed'),
  min: 0,
  max: 999999,
  step: 1,
  defaultValue: 42
}

const imageUpload: FieldSchema = {
  kind: 'file',
  name: 'image',
  label: t('workshop.field.image'),
  accept: ACCEPT.image,
  maxBytes: MAX_UPLOAD_BYTES,
  required: false
}

const aspectRatio: FieldSchema = {
  kind: 'select',
  name: 'aspect_ratio',
  label: t('workshop.field.aspectRatio'),
  options: ['16:9', '9:16', '1:1', '4:3'],
  defaultValue: '16:9'
}

// Fallback schemas for models whose partner node the generator could not
// resolve. Everything else comes from workshop-models.generated.json.
const fallbackSchemas: Record<Modality | 'other', readonly FieldSchema[]> = {
  image: [prompt, imageUpload, aspectRatio, seed],
  video: [
    prompt,
    imageUpload,
    aspectRatio,
    {
      kind: 'number',
      name: 'duration',
      label: t('workshop.field.duration'),
      min: 2,
      max: 10,
      step: 1,
      defaultValue: 5
    },
    seed
  ],
  audio: [prompt, seed],
  '3d': [prompt, imageUpload, seed],
  text: [prompt],
  other: [prompt, seed]
}

export function schemaForModel(
  model: Pick<WorkshopModelDetail, 'fields' | 'modality'>
): readonly FieldSchema[] {
  return model.fields.length
    ? model.fields.map(fromGenerated)
    : fallbackSchemas[model.modality ?? 'other']
}

export function defaultValues(
  schema: readonly FieldSchema[],
  overrides: Readonly<Record<string, string | number | boolean>> = {}
): FormValues {
  return Object.fromEntries(
    schema.map((field) => [
      field.name,
      overrides[field.name] ??
        (field.kind === 'select' ||
        field.kind === 'number' ||
        field.kind === 'toggle'
          ? field.defaultValue
          : undefined)
    ])
  )
}

export function validateForm(
  schema: readonly FieldSchema[],
  values: FormValues
): FieldErrors {
  const errors: Record<string, FieldErrorCode> = {}
  for (const field of schema) {
    const value = values[field.name]
    if (field.kind === 'text') {
      if (field.required && (typeof value !== 'string' || !value.trim())) {
        errors[field.name] = 'required'
      }
    } else if (field.kind === 'file') {
      if (value === undefined) {
        if (field.required) errors[field.name] = 'required'
      } else if (typeof value === 'object') {
        if (!field.accept.includes(value.type)) errors[field.name] = 'badType'
        else if (value.size > field.maxBytes) errors[field.name] = 'tooLarge'
      }
    } else if (field.kind === 'number') {
      if (typeof value !== 'number' || !isWithinRange(value, field)) {
        errors[field.name] = 'outOfRange'
      }
    } else if (field.kind === 'select') {
      if (typeof value !== 'string' || !field.options.includes(value)) {
        errors[field.name] = 'badOption'
      }
    }
  }
  return errors
}

function isWithinRange(
  value: number,
  { min, max, step }: { min: number; max: number; step: number }
): boolean {
  if (Number.isNaN(value) || value < min || value > max) return false
  const steps = (value - min) / step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

export interface PlaygroundExample {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly values: Readonly<Record<string, string | number | boolean>>
  readonly outputUrl: string
  readonly nodeDisplayName?: string
  readonly fields?: readonly GeneratedField[]
}

export function examplesForModel(
  model: Pick<WorkshopModelDetail, 'examples'>
): readonly PlaygroundExample[] {
  return model.examples.map((example: GeneratedExample) => ({
    id: example.name,
    title: example.title,
    description: example.description,
    values: example.values,
    outputUrl: example.thumbnailUrl,
    ...(example.node ? { nodeDisplayName: example.node.displayName } : {}),
    ...(example.fields ? { fields: example.fields } : {})
  }))
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

// Placeholder pricing until Router quotes a run: partner nodes price by
// duration, resolution and batch size, so the estimate moves with them.
export function estimateCredits(base: number, values: FormValues): number {
  const number = (name: string) => {
    const value = values[name]
    return typeof value === 'number' && value > 0 ? value : undefined
  }
  const text = (name: string) => {
    const value = values[name]
    return typeof value === 'string' ? value.toLowerCase() : ''
  }
  const duration = number('duration')
  const resolution = text('resolution')
  const batch = number('n') ?? number('num_images') ?? number('count') ?? 1
  const resolutionFactor = /4k|2160/.test(resolution)
    ? 2
    : /1080/.test(resolution)
      ? 1.5
      : 1
  return Math.max(
    1,
    Math.round(base * (duration ? duration / 5 : 1) * resolutionFactor * batch)
  )
}
