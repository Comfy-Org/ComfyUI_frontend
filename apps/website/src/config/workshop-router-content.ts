import catalogJson from '../content/workshop-models.json'
import displayJson from '../content/workshop-display.json'
import { workshopDisplaySchema } from '../content/workshop-display.schema'
import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import { workshopModelSchema } from '../content/workshop-models.schema'
import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type {
  GeneratedExample,
  GeneratedField,
  Modality,
  UseCase,
  WorkshopModel,
  WorkshopModelDetail
} from './workshop'

type JsonRecord = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function labelFor(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function hintFor(schema: JsonRecord): { readonly hint?: string } {
  return typeof schema.description === 'string'
    ? { hint: schema.description }
    : {}
}

function primitiveOptions(schema: JsonRecord): string[] {
  if (Array.isArray(schema.enum)) {
    return schema.enum
      .filter(
        (value) =>
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
      )
      .map(String)
  }
  if (!Array.isArray(schema.anyOf)) return []
  return schema.anyOf.flatMap((variant) =>
    isRecord(variant) ? primitiveOptions(variant) : []
  )
}

function textField(
  name: string,
  schema: JsonRecord,
  required: boolean
): GeneratedField {
  const defaultValue =
    typeof schema.default === 'string'
      ? schema.default
      : schema.default === undefined
        ? undefined
        : JSON.stringify(schema.default, null, 2)
  return {
    kind: 'text',
    name,
    label: labelFor(name),
    ...hintFor(schema),
    required,
    multiline:
      schema.type !== 'string' ||
      typeof schema.maxLength !== 'number' ||
      schema.maxLength > 200,
    ...(defaultValue === undefined ? {} : { default: defaultValue })
  }
}

function fieldFor(
  name: string,
  schema: JsonRecord,
  required: boolean
): GeneratedField {
  const options = primitiveOptions(schema)
  if (options.length > 0) {
    const defaultValue =
      schema.default === undefined ? options[0] : String(schema.default)
    return {
      kind: 'select',
      name,
      label: labelFor(name),
      ...hintFor(schema),
      options,
      default: defaultValue
    }
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    const defaultValue =
      typeof schema.default === 'number'
        ? schema.default
        : typeof schema.minimum === 'number'
          ? schema.minimum
          : 0
    const min =
      typeof schema.minimum === 'number'
        ? schema.minimum
        : Math.min(0, defaultValue)
    const candidateMax =
      typeof schema.maximum === 'number'
        ? schema.maximum
        : Math.max(100, defaultValue * 2)
    return {
      kind: 'number',
      name,
      label: labelFor(name),
      ...hintFor(schema),
      min,
      max: candidateMax > min ? candidateMax : min + 1,
      step:
        typeof schema.multipleOf === 'number'
          ? schema.multipleOf
          : schema.type === 'integer'
            ? 1
            : 0.01,
      default: defaultValue
    }
  }
  if (schema.type === 'boolean') {
    return {
      kind: 'toggle',
      name,
      label: labelFor(name),
      ...hintFor(schema),
      default: typeof schema.default === 'boolean' ? schema.default : false
    }
  }
  return textField(name, schema, required)
}

function requiredNames(parameters: JsonRecord): ReadonlySet<string> {
  return new Set(
    Array.isArray(parameters.required)
      ? parameters.required.filter(
          (value): value is string => typeof value === 'string'
        )
      : []
  )
}

function acceptFor(role: string): 'image' | 'video' | 'audio' {
  if (role.includes('video')) return 'video'
  if (role.includes('audio')) return 'audio'
  return 'image'
}

function fieldsFor(model: WorkshopModelEntry): GeneratedField[] {
  const properties = isRecord(model.parameters.properties)
    ? model.parameters.properties
    : {}
  const required = requiredNames(model.parameters)
  const fields = Object.entries(properties).flatMap(([name, schema]) => {
    if (
      name === 'model' ||
      name === 'medias' ||
      name === 'dispatch_mode' ||
      !isRecord(schema)
    ) {
      return []
    }
    return [fieldFor(name, schema, required.has(name))]
  })
  return [
    ...fields,
    ...model.roles.map(
      (role): GeneratedField => ({
        kind: 'file',
        name: `media_${role.role}`,
        label: labelFor(role.role),
        accept: acceptFor(role.role),
        required: role.required
      })
    )
  ]
}

function defaultValues(
  fields: readonly GeneratedField[]
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    fields.flatMap((field) =>
      'default' in field && field.default !== undefined
        ? [[field.name, field.default]]
        : []
    )
  )
}

function formValue(value: unknown): string | number | boolean {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  return value === null ? '' : JSON.stringify(value)
}

function examplesFor(
  model: WorkshopModelEntry,
  display: WorkshopDisplayEntry
): GeneratedExample[] {
  const samples = display.media.samples ?? []
  return samples.slice(0, 6).map((sample, index) => {
    const example = display.examples[index]
    return {
      name: `${model.slug}-example-${index + 1}`,
      title: example?.title ?? `Sample ${index + 1}`,
      description: example?.description ?? '',
      tags: model.tags,
      thumbnailUrl: sample.url,
      mediaKind: sample.kind,
      values: Object.fromEntries(
        Object.entries(example?.values ?? {}).map(([name, value]) => [
          name,
          formValue(value)
        ])
      )
    }
  })
}

function modalityFor(model: WorkshopModelEntry): Modality {
  if (model.modality === 'music') return 'audio'
  if (model.modality === 'svg') return 'image'
  return model.modality
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  bfl: 'Black Forest Labs',
  byteplus: 'ByteDance',
  'byteplus-mediakit': 'ByteDance',
  elevenlabs: 'ElevenLabs',
  fishaudio: 'Fish Audio',
  gemini: 'Google',
  ltx: 'Lightricks',
  luma_2: 'Luma',
  openai: 'OpenAI',
  synclabs: 'Sync Labs',
  'tencent-hunyuan3d': 'Tencent',
  vertexai: 'Google',
  wavespeed: 'WaveSpeed',
  xai: 'xAI'
}

function providerName(provider: string): string {
  return (
    PROVIDER_NAMES[provider] ??
    provider
      .split('-')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ')
  )
}

// Router does not expose usage counts yet. Keep Mar's prototype treatment:
// a stable, clearly synthetic ordering value rather than showing every model
// as having zero runs in the popular-model picker.
function placeholderRuns(slug: string, workflowCount: number): number {
  let seed = 7
  for (let index = 0; index < slug.length; index += 1) {
    seed = (seed * 31 + slug.charCodeAt(index)) % 1_000_003
  }
  return (workflowCount + 1) * (4000 + (seed % 37) * 1000)
}

function taskForUseCases(useCases: readonly UseCase[]): WorkshopModel['task'] {
  if (useCases.includes('edit-images')) return 'image-to-image'
  if (useCases.includes('animate-images')) return 'image-to-video'
  if (useCases.includes('edit-videos')) return 'video-to-video'
  if (useCases.includes('generate-images')) return 'text-to-image'
  if (useCases.includes('generate-videos')) return 'text-to-video'
  if (useCases.includes('audio')) return 'text-to-audio'
  if (useCases.includes('3d')) return 'text-to-3d'
  return 'text-to-text'
}

const catalog = (catalogJson as unknown[]).map((entry) =>
  workshopModelSchema.parse(entry)
)
const display = (displayJson as unknown[]).map((entry) =>
  workshopDisplaySchema.parse(entry)
)
const displayById = new Map(display.map((entry) => [entry.id, entry]))

const records = catalog.map((entry) => {
  const overlay = displayById.get(entry.id)
  if (!overlay)
    throw new Error(`Missing Workshop display entry for ${entry.id}`)
  const fields = fieldsFor(entry)
  const examples = examplesFor(entry, overlay)
  const modality = modalityFor(entry)
  const thumbnail = overlay.media.thumbnail
  const model: WorkshopModel = {
    slug: entry.slug,
    name: entry.displayName,
    workflowCount: examples.length,
    href: `/workshop/models/${entry.slug}/`,
    routerId: entry.id,
    provider: providerName(entry.provider),
    modality,
    task: taskForUseCases(overlay.useCases),
    useCases: overlay.useCases,
    capabilities: entry.tags,
    runs: placeholderRuns(entry.slug, examples.length),
    ...(overlay.pricing
      ? { creditsPerRun: overlay.pricing.creditsPerRun }
      : {}),
    ...(thumbnail
      ? {
          thumbnailUrl: thumbnail.url,
          thumbnail: { url: thumbnail.url, kind: thumbnail.kind }
        }
      : {}),
    ...(overlay.status === 'deprecated'
      ? { status: 'deprecated' as const }
      : {})
  }
  const detail: WorkshopModelDetail = {
    ...model,
    fields,
    defaults: defaultValues(fields),
    examples
  }
  return { model, detail }
})

export const routerWorkshopModels = records.map((record) => record.model)
const detailBySlug = new Map(
  records.map((record) => [record.model.slug, record.detail])
)

export function getRouterWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  return detailBySlug.get(slug)
}
