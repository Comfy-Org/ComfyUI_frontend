import { t } from '../i18n/translations'
import { fieldsForDefinition } from './workshop-form-definition'
import { workshopExampleFiles } from './workshop-example-file'
import type { WorkshopInputDefinition } from './workshop-input-definition'
import {
  parseWorkshopJsonInput,
  validateWorkshopInput
} from './workshop-json-schema'
import type {
  GeneratedExample,
  GeneratedField,
  Modality,
  WorkshopExampleValues,
  WorkshopModelDetail
} from './models-catalogue'

type FieldControl =
  | {
      readonly kind: 'text'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly placeholder?: string
      readonly required: boolean
      readonly multiline: boolean
      readonly defaultValue?: string
      readonly valueType?: 'string' | 'json'
      readonly jsonSchema?: Readonly<Record<string, unknown>>
      readonly suggestions?: readonly (string | number | boolean)[]
      readonly minLength?: number
      readonly maxLength?: number
    }
  | {
      readonly kind: 'select'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly (string | number | boolean)[]
      readonly defaultValue?: string | number | boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'number'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly min?: number
      readonly max?: number
      readonly step: number | 'any'
      readonly defaultValue?: number
      readonly required?: boolean
    }
  | {
      readonly kind: 'toggle'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly defaultValue?: boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'file'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly accept: readonly string[]
      readonly maxBytes: number
      readonly required: boolean
      readonly multiple?: boolean
      readonly maxItems?: number
    }

export type FieldSchema = FieldControl & {
  readonly inputSchema?: Readonly<Record<string, unknown>>
  readonly presentation?: WorkshopInputDefinition
}

export interface FileValue {
  readonly name: string
  readonly size: number
  readonly type: string
  readonly previewUrl?: string
  readonly file?: File
  readonly sourceUrl?: string
}

export type FieldValue =
  | string
  | number
  | boolean
  | FileValue
  | FileValue[]
  | undefined
export type FormValues = Readonly<Record<string, FieldValue>>
export type FieldErrorCode =
  | 'required'
  | 'tooLarge'
  | 'requestTooLarge'
  | 'badType'
  | 'outOfRange'
  | 'badOption'
  | 'uploadFailed'
  | 'rejected'
export type FieldErrors = Readonly<Record<string, FieldErrorCode>>

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const ACCEPT: Record<'image' | 'video' | 'audio' | 'file', readonly string[]> =
  {
    image: ['image/png', 'image/jpeg', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'],
    file: []
  }

const URL_UPLOAD_ACCEPT: Record<
  NonNullable<WorkshopInputDefinition['urlUpload']>,
  readonly string[]
> = {
  image: ACCEPT.image,
  video: ACCEPT.video,
  audio: ACCEPT.audio,
  'image-or-video': [...ACCEPT.image, ...ACCEPT.video],
  file: ACCEPT.file
}

export function urlUploadField(
  field: FieldSchema
): Extract<FieldSchema, { kind: 'file' }> | undefined {
  const media =
    field.presentation?.urlUpload ??
    (field.presentation?.imageSource === 'url' ? 'image' : undefined)
  if (!media || field.kind !== 'text' || field.valueType === 'json')
    return undefined
  return {
    kind: 'file',
    name: field.name,
    label: field.label,
    required: field.required,
    accept: URL_UPLOAD_ACCEPT[media],
    maxBytes: MAX_UPLOAD_BYTES
  }
}

export interface PlaygroundFieldGroups {
  readonly primary: readonly FieldSchema[]
  readonly settings: readonly FieldSchema[]
  readonly advanced: readonly FieldSchema[]
}

const SETTINGS_SHOWN = 3

/**
 * Explicit overlay metadata wins. The positional fallback keeps legacy
 * generated fixtures and workflow pages working until they carry metadata.
 */
export function groupPlaygroundFields(
  schema: readonly FieldSchema[]
): PlaygroundFieldGroups {
  const withoutPicker = schema.filter(
    (field) => field.name !== 'model' || field.inputSchema
  )
  const shown = withoutPicker.length > 0 ? withoutPicker : schema
  const hasExplicitGroups = shown.some((field) => field.advanced !== undefined)
  const standard = hasExplicitGroups
    ? shown.filter((field) => field.advanced !== true)
    : shown
  const primary = standard.filter(
    (field) => field.kind === 'text' || field.kind === 'file'
  )
  const rest = standard.filter(
    (field) => field.kind !== 'text' && field.kind !== 'file'
  )
  const knobs = rest.filter((field) => field.kind !== 'toggle')
  return {
    primary,
    settings: hasExplicitGroups ? rest : knobs.slice(0, SETTINGS_SHOWN),
    advanced: hasExplicitGroups
      ? shown
          .filter((field) => field.advanced === true)
          .sort(
            (a, b) =>
              (a.advancedIndex ?? Number.MAX_SAFE_INTEGER) -
              (b.advancedIndex ?? Number.MAX_SAFE_INTEGER)
          )
      : [
          ...knobs.slice(SETTINGS_SHOWN),
          ...rest.filter((field) => field.kind === 'toggle')
        ]
  }
}

function fromGenerated(field: GeneratedField): FieldSchema {
  const grouping =
    field.advanced === undefined
      ? {}
      : {
          advanced: field.advanced,
          ...(field.advancedIndex === undefined
            ? {}
            : { advancedIndex: field.advancedIndex })
        }
  const contract = {
    ...(field.inputSchema ? { inputSchema: field.inputSchema } : {}),
    ...(field.presentation ? { presentation: field.presentation } : {})
  }
  switch (field.kind) {
    case 'text':
      return {
        kind: 'text',
        name: field.name,
        label: field.label,
        ...grouping,
        ...contract,
        ...(field.hint ? { hint: field.hint } : {}),
        required: field.required,
        multiline: field.multiline,
        defaultValue: field.default,
        valueType: field.valueType,
        jsonSchema: field.jsonSchema,
        suggestions: field.suggestions,
        minLength: field.minLength,
        maxLength: field.maxLength
      }
    case 'number':
      return {
        kind: 'number',
        name: field.name,
        label: field.label,
        ...grouping,
        ...contract,
        ...(field.hint ? { hint: field.hint } : {}),
        min: field.min,
        max: field.max,
        step: field.step,
        required: field.required,
        defaultValue: field.default
      }
    case 'select':
      return {
        kind: 'select',
        name: field.name,
        label: field.label,
        ...grouping,
        ...contract,
        ...(field.hint ? { hint: field.hint } : {}),
        options: field.options,
        required: field.required,
        defaultValue: field.default
      }
    case 'toggle':
      return {
        kind: 'toggle',
        name: field.name,
        label: field.label,
        ...grouping,
        ...contract,
        ...(field.hint ? { hint: field.hint } : {}),
        required: field.required,
        defaultValue: field.default
      }
    case 'file':
      return {
        kind: 'file',
        name: field.name,
        label: field.label,
        ...grouping,
        ...contract,
        ...(field.hint ? { hint: field.hint } : {}),
        accept: field.mimeTypes ?? ACCEPT[field.accept],
        maxBytes: MAX_UPLOAD_BYTES,
        required: field.required,
        multiple: field.multiple,
        maxItems: field.maxItems
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
  model: Pick<
    WorkshopModelDetail,
    'fields' | 'modality' | 'form' | 'incompleteReason'
  >
): readonly FieldSchema[] {
  if (model.incompleteReason) return []
  if (model.form) return fieldsForDefinition(model.form).map(fromGenerated)
  return model.fields.length
    ? model.fields.map(fromGenerated)
    : fallbackSchemas[model.modality ?? 'other']
}

export function defaultValues(
  schema: readonly FieldSchema[],
  overrides: WorkshopExampleValues = {}
): FormValues {
  return Object.fromEntries(
    schema.map((field) => {
      const override = overrides[field.name]
      const value =
        field.kind === 'file'
          ? typeof override === 'string' || typeof override === 'object'
            ? workshopExampleFiles(override, field.multiple, field.accept[0])
            : undefined
          : typeof override === 'object'
            ? undefined
            : override
      return [
        field.name,
        value ??
          (field.kind === 'text' ||
          field.kind === 'select' ||
          field.kind === 'number' ||
          field.kind === 'toggle'
            ? field.defaultValue
            : undefined)
      ]
    })
  )
}

export function validateForm(
  schema: readonly FieldSchema[],
  values: FormValues
): FieldErrors {
  const errors: Record<string, FieldErrorCode> = {}
  for (const source of schema) {
    const value = values[source.name]
    const field =
      (typeof value === 'object' ? urlUploadField(source) : undefined) ?? source
    if (value === undefined || value === '') {
      if (field.required) errors[field.name] = 'required'
      continue
    }
    if (field.kind === 'text') {
      if (typeof value !== 'string' || (field.required && !value.trim())) {
        errors[field.name] = 'required'
      } else if (
        (field.minLength !== undefined &&
          Array.from(value).length < field.minLength) ||
        (field.maxLength !== undefined &&
          Array.from(value).length > field.maxLength) ||
        (field.valueType === 'json' &&
          field.jsonSchema !== undefined &&
          !parseWorkshopJsonInput(value, field.jsonSchema).success)
      ) {
        errors[field.name] = 'rejected'
      }
    } else if (field.kind === 'file') {
      if (typeof value === 'object') {
        const files = Array.isArray(value) ? value : [value]
        if (files.length === 0 && field.required)
          errors[field.name] = 'required'
        else if (
          (!field.multiple && files.length > 1) ||
          (field.maxItems !== undefined && files.length > field.maxItems)
        )
          errors[field.name] = 'rejected'
        else if (
          field.accept.length > 0 &&
          files.some((file) => !field.accept.includes(file.type))
        )
          errors[field.name] = 'badType'
        else if (files.some((file) => file.size > field.maxBytes))
          errors[field.name] = 'tooLarge'
      } else {
        errors[field.name] = 'badType'
      }
    } else if (field.kind === 'number') {
      if (
        typeof value !== 'number' ||
        !isWithinRange(value, field, field.inputSchema === undefined)
      ) {
        errors[field.name] = 'outOfRange'
      }
    } else if (field.kind === 'select') {
      if (typeof value === 'object' || !field.options.includes(value)) {
        errors[field.name] = 'badOption'
      }
    } else if (typeof value !== 'boolean') {
      errors[field.name] = 'badType'
    }
    if (
      !Object.hasOwn(errors, field.name) &&
      field.inputSchema &&
      field.kind !== 'file'
    ) {
      const result =
        field.kind === 'text' && field.valueType === 'json'
          ? typeof value === 'string' &&
            parseWorkshopJsonInput(value, field.inputSchema).success
          : validateWorkshopInput(value, field.inputSchema)
      if (!result) errors[field.name] = 'rejected'
    }
  }
  return errors
}

export function restoreFormValues(
  schema: readonly FieldSchema[],
  stored: unknown
): FormValues {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return {}
  }
  const fields = new Map(schema.map((field) => [field.name, field]))
  const restored: Record<string, FieldValue> = {}
  for (const [name, value] of Object.entries(stored)) {
    const field = fields.get(name)
    if (!field || field.kind === 'file') continue
    if (value === null || value === '') {
      restored[name] = undefined
    } else if (
      (typeof value === 'string' ||
        typeof value === 'boolean' ||
        typeof value === 'number') &&
      !Object.hasOwn(validateForm([field], { [name]: value }), name)
    ) {
      restored[name] = value
    }
  }
  return restored
}

function isWithinRange(
  value: number,
  { min, max, step }: { min?: number; max?: number; step: number | 'any' },
  validateStep: boolean
): boolean {
  if (
    !Number.isFinite(value) ||
    (min !== undefined && value < min) ||
    (max !== undefined && value > max)
  )
    return false
  if (step === 'any' || !validateStep) return true
  const steps = (value - (min ?? 0)) / step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

export interface PlaygroundExample {
  readonly id: string
  readonly title: string
  /** The few settings worth reading back: size, then length. */
  readonly specs: readonly string[]
  readonly values: WorkshopExampleValues
  readonly outputUrl: string
  readonly mediaKind?: 'image' | 'video' | 'audio'
  readonly sampleOnly?: boolean
  readonly nodeDisplayName?: string
  readonly fields?: readonly GeneratedField[]
}

const SIZE_KEYS = ['resolution', 'size', 'aspect_ratio', 'ratio'] as const

function specsOf(values: WorkshopExampleValues): string[] {
  // 'auto' and the like name no size, so only a value carrying a number reads
  // as one.
  const size = SIZE_KEYS.map((key) => values[key]).find(
    (value) => typeof value === 'string' && /\d/.test(value)
  )
  const duration: unknown = values.duration
  const seconds =
    typeof duration === 'number' ||
    (typeof duration === 'string' && duration !== '')
  return [
    // A label like '720p: 16:9 (1280x720)' says it once in its first word.
    ...(size === undefined ? [] : [String(size).replace(/:\s.*$/, '')]),
    ...(seconds ? [`${duration}s`] : [])
  ]
}

// The tab already says which model made these, so a title that opens by
// naming it again says nothing. It stays whenever dropping it would leave two
// cards reading the same, which is what tells one variant from another.
function titlesWithoutTheirPrefix(
  examples: readonly GeneratedExample[]
): readonly string[] {
  const short = examples.map(
    (example) => /^.+?:\s+(.+)$/.exec(example.title)?.[1] ?? example.title
  )
  const seen = new Set<string>()
  const repeated = new Set(
    short.filter((title) => seen.size === seen.add(title).size)
  )
  return examples.map((example, index) =>
    repeated.has(short[index]) ? example.title : short[index]
  )
}

export function examplesForModel(
  model: Pick<WorkshopModelDetail, 'examples'>
): readonly PlaygroundExample[] {
  const titles = titlesWithoutTheirPrefix(model.examples)
  return model.examples.map((example: GeneratedExample, index) => {
    return {
      id: example.name,
      title: titles[index],
      specs: specsOf(example.values),
      values: example.values,
      outputUrl: example.thumbnailUrl,
      ...(example.sampleOnly ? { sampleOnly: true } : {}),
      ...(example.mediaKind ? { mediaKind: example.mediaKind } : {}),
      ...(example.node ? { nodeDisplayName: example.node.displayName } : {}),
      ...(example.fields ? { fields: example.fields } : {})
    }
  })
}

export function exampleValues(
  schema: readonly FieldSchema[],
  example: PlaygroundExample
): FormValues {
  return defaultValues(schema, example.values)
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)
}
