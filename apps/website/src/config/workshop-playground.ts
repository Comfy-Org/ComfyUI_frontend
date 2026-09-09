import { t } from '../i18n/translations'
import { isSeedField } from './seed-fields'
import type {
  ExampleInput,
  GeneratedExample,
  GeneratedField,
  Modality,
  WorkshopModelDetail
} from './models-catalogue'

export type FieldSchema =
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
    }
  | {
      readonly kind: 'select'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly string[]
      readonly defaultValue: string
    }
  | {
      readonly kind: 'number'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly min: number
      readonly max: number
      readonly step: number
      /** Absent on seed-like fields: empty means the provider picks. */
      readonly defaultValue?: number
    }
  | {
      readonly kind: 'toggle'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly defaultValue: boolean
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
      /** Several files, held as an array value; limits from the Router role. */
      readonly multiple?: boolean
      readonly minItems?: number
      readonly maxItems?: number
    }

export interface FileValue {
  readonly name: string
  readonly size: number
  readonly type: string
  readonly previewUrl?: string
}

export type FieldValue =
  | string
  | number
  | boolean
  | FileValue
  | readonly FileValue[]
  | undefined
export type FormValues = Readonly<Record<string, FieldValue>>
export type FieldErrorCode =
  | 'required'
  | 'tooLarge'
  | 'tooMany'
  | 'tooFew'
  | 'badType'
  | 'outOfRange'
  | 'badOption'
  | 'rejected'
export type FieldErrors = Readonly<Record<string, FieldErrorCode>>

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

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
  const withoutPicker = schema.filter((field) => field.name !== 'model')
  const shown = withoutPicker.length > 0 ? withoutPicker : schema
  const hasExplicitGroups = shown.some((field) => field.advanced !== undefined)
  const standard = hasExplicitGroups
    ? shown.filter((field) => field.advanced !== true)
    : shown
  const lastPrimary = standard.reduce(
    (last, field, index) =>
      field.kind === 'text' || field.kind === 'file' ? index : last,
    -1
  )
  const rest = standard.slice(lastPrimary + 1)
  const knobs = rest.filter((field) => field.kind !== 'toggle')
  return {
    primary: standard.slice(0, lastPrimary + 1),
    settings: hasExplicitGroups ? knobs : knobs.slice(0, SETTINGS_SHOWN),
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

const ACCEPT: Record<'image' | 'video' | 'audio', readonly string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4']
}

function fromGenerated(field: GeneratedField): FieldSchema {
  const presentation =
    field.advanced === undefined
      ? {}
      : {
          advanced: field.advanced,
          ...(field.advancedIndex === undefined
            ? {}
            : { advancedIndex: field.advancedIndex })
        }
  switch (field.kind) {
    case 'text':
      return {
        kind: 'text',
        name: field.name,
        label: field.label,
        ...presentation,
        ...(field.hint ? { hint: field.hint } : {}),
        required: field.required,
        multiline: field.multiline
      }
    case 'number':
      return {
        kind: 'number',
        name: field.name,
        label: field.label,
        ...presentation,
        ...(field.hint ? { hint: field.hint } : {}),
        min: field.min,
        max: field.max,
        step: field.step,
        ...(field.default === undefined ? {} : { defaultValue: field.default })
      }
    case 'select':
      return {
        kind: 'select',
        name: field.name,
        label: field.label,
        ...presentation,
        ...(field.hint ? { hint: field.hint } : {}),
        options: field.options,
        defaultValue: field.default
      }
    case 'toggle':
      return {
        kind: 'toggle',
        name: field.name,
        label: field.label,
        ...presentation,
        ...(field.hint ? { hint: field.hint } : {}),
        defaultValue: field.default
      }
    case 'file':
      return {
        kind: 'file',
        name: field.name,
        label: field.label,
        ...presentation,
        ...(field.hint ? { hint: field.hint } : {}),
        accept: ACCEPT[field.accept],
        maxBytes: MAX_UPLOAD_BYTES,
        required: field.required,
        ...(field.multiple ? { multiple: true } : {}),
        ...(field.minItems === undefined ? {} : { minItems: field.minItems }),
        ...(field.maxItems === undefined ? {} : { maxItems: field.maxItems })
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

export function isFileList(value: FieldValue): value is readonly FileValue[] {
  return Array.isArray(value)
}

/** The files a field holds, as a list; undefined when the value is not a file. */
export function fileList(value: FieldValue): readonly FileValue[] | undefined {
  if (value === undefined || value === '') return []
  if (isFileList(value)) return value
  return typeof value === 'object' ? [value] : undefined
}

/** How many files a field accepts: its Router limit, else one unless `multiple`. */
export function maxFiles(
  field: Extract<FieldSchema, { kind: 'file' }>
): number {
  if (!field.multiple) return 1
  return field.maxItems ?? Number.POSITIVE_INFINITY
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
      const files = fileList(value)
      if (files === undefined) {
        errors[field.name] = 'badType'
      } else if (files.length === 0) {
        if (field.required) errors[field.name] = 'required'
      } else if (files.some((file) => !field.accept.includes(file.type))) {
        errors[field.name] = 'badType'
      } else if (files.some((file) => file.size > field.maxBytes)) {
        errors[field.name] = 'tooLarge'
      } else if (files.length > maxFiles(field)) {
        errors[field.name] = 'tooMany'
      } else if (
        field.minItems !== undefined &&
        files.length < field.minItems
      ) {
        errors[field.name] = 'tooFew'
      }
    } else if (field.kind === 'number') {
      // A seed-like field has no default and may stay empty: the request
      // then omits it and the provider randomises.
      const empty = value === undefined || value === ''
      if (
        empty
          ? field.defaultValue !== undefined
          : typeof value !== 'number' || !isWithinRange(value, field)
      ) {
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
  /** The few settings worth reading back: size, then length. */
  readonly specs: readonly string[]
  readonly values: Readonly<Record<string, string | number | boolean>>
  readonly outputUrl: string
  readonly mediaKind?: 'image' | 'video' | 'audio'
  readonly nodeDisplayName?: string
  readonly fields?: readonly GeneratedField[]
  /** The input media the example ran with, by Router role. */
  readonly inputs?: readonly ExampleInput[]
}

const SIZE_KEYS = ['resolution', 'size', 'aspect_ratio', 'ratio'] as const

function specsOf(
  values: Readonly<Record<string, string | number | boolean>>
): string[] {
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
      ...(example.mediaKind ? { mediaKind: example.mediaKind } : {}),
      ...(example.node ? { nodeDisplayName: example.node.displayName } : {}),
      ...(example.fields ? { fields: example.fields } : {}),
      ...(example.inputs ? { inputs: example.inputs } : {})
    }
  })
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav'
}

function fileNameOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? url
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
}

function fileFromUrl(url: string): FileValue {
  const name = fileNameOf(url)
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const type = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
  return {
    name,
    size: 1,
    type,
    ...(type.startsWith('image/') ? { previewUrl: url } : {})
  }
}

// Prefills the form with an example: its values plus, for every file field
// the example ran with an input for, that input (its real URL, previewed
// when it is an image), so the page arrives showing what produced the output.
// A role the example did not use stays empty rather than getting a stand-in.
export function exampleValues(
  schema: readonly FieldSchema[],
  example: PlaygroundExample
): FormValues {
  const inputs = example.inputs ?? []
  const uploads = Object.fromEntries(
    schema.flatMap((field): [string, FieldValue][] => {
      if (field.kind !== 'file') return []
      const role = field.name.replace(/^media_/, '')
      const matching = inputs.filter((input) => input.role === role)
      if (matching.length === 0) return []
      const files = matching.map((input) => fileFromUrl(input.url))
      // A "many" role holds every input; a single-file role keeps the first
      // and says how many the example actually used.
      if (field.multiple) return [[field.name, files]]
      const first = files[0]
      return [
        [
          field.name,
          matching.length > 1
            ? { ...first, name: `${first.name} (+${matching.length - 1} more)` }
            : first
        ]
      ]
    })
  )
  // The seed an example ran with is never prefilled: every page loads with
  // an empty seed, so a run varies unless the visitor pins one.
  const values = Object.fromEntries(
    Object.entries(example.values).filter(([name]) => !isSeedField(name))
  )
  return { ...defaultValues(schema, values), ...uploads }
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)
}
