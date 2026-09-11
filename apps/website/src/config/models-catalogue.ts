import { z } from 'astro/zod'

import type { Model } from './models'
import type { WorkshopFormDefinition } from './workshop-form-definition'
import type { WorkshopContract } from './workshop-contract'
import type { WorkshopInputDefinition } from './workshop-input-definition'
import { workshopInputDefinitionSchema } from './workshop-input-definition'
import { OTHER_FORMAT_USE_CASES } from './workshop-sections'
import {
  routerWorkshopModels,
  routerModelSlugAliases
} from './workshop-browse-content'

export const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

const MODALITY_FILTERS = ['all', ...MODALITIES, 'other'] as const
export type ModalityFilter = (typeof MODALITY_FILTERS)[number]

export type ModelStatus = 'deprecated' | 'degraded'

const TASK_INPUTS = ['text', 'image', 'video', 'audio'] as const
export type TaskInput = (typeof TASK_INPUTS)[number]
export type WorkshopTask = `${TaskInput}-to-${Exclude<ModalityFilter, 'all'>}`

type GeneratedFieldControl =
  | {
      readonly kind: 'text'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly multiline: boolean
      readonly required: boolean
      readonly default?: string
      readonly valueType?: 'string' | 'json'
      readonly jsonSchema?: Readonly<Record<string, unknown>>
      readonly suggestions?: readonly (string | number | boolean)[]
      readonly minLength?: number
      readonly maxLength?: number
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
      readonly default?: number
      readonly required?: boolean
    }
  | {
      readonly kind: 'select'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly (string | number | boolean)[]
      readonly default?: string | number | boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'toggle'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly default?: boolean
      readonly required?: boolean
    }
  | {
      readonly kind: 'file'
      readonly advanced?: boolean
      readonly advancedIndex?: number
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly accept: 'image' | 'video' | 'audio' | 'file'
      readonly mimeTypes?: readonly string[]
      readonly required: boolean
      readonly multiple?: boolean
      readonly maxItems?: number
    }

export type GeneratedField = GeneratedFieldControl & {
  readonly inputSchema?: Readonly<Record<string, unknown>>
  readonly presentation?: WorkshopInputDefinition
}

export type WorkshopExampleValues = Readonly<
  Partial<Record<string, string | number | boolean | readonly string[]>>
>

export interface GeneratedExample {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly tags: readonly string[]
  readonly thumbnailUrl: string
  readonly mediaKind?: 'image' | 'video' | 'audio'
  readonly sampleOnly?: boolean
  readonly node?: { readonly id: string; readonly displayName: string }
  readonly fields?: readonly GeneratedField[]
  readonly values: WorkshopExampleValues
}

interface GeneratedModel {
  readonly thumbnailUrl?: string
  readonly provider?: string
  readonly modality?: Modality
  readonly priceUsdFrom?: number
  readonly node?: { id: string; displayName: string; template: string }
  readonly fields: readonly GeneratedField[]
  readonly defaults: WorkshopExampleValues
  readonly examples: readonly GeneratedExample[]
}

export interface WorkshopModel {
  readonly slug: string
  readonly name: string
  readonly workflowCount: number
  readonly href: string
  readonly routerId: string
  readonly incompleteReason?: 'missing-input-schema'
  readonly provider?: string
  readonly modality?: Modality
  readonly modalities?: readonly Modality[]
  readonly task?: WorkshopTask
  readonly capabilities: readonly string[]
  readonly creditsPerRun?: number
  readonly priceUsdFrom?: number
  readonly thumbnailUrl?: string
  readonly thumbnailLabel?: string
  readonly thumbnail?: {
    readonly url: string
    readonly kind: 'image' | 'video' | 'audio'
  }
  readonly useCases?: readonly UseCase[]
  readonly summary?: string
  readonly status?: ModelStatus
  readonly successorSlug?: string
}

export interface WorkshopModelDetail extends WorkshopModel {
  readonly nodeDisplayName?: string
  readonly form?: WorkshopFormDefinition
  readonly execution?: WorkshopContract
  readonly fields: readonly GeneratedField[]
  readonly defaults: WorkshopExampleValues
  readonly examples: readonly GeneratedExample[]
}

const scalar = z.union([z.string(), z.number(), z.boolean()])
const schemaObject = z.record(z.string(), z.json())
const formValues = z.record(z.string(), z.union([scalar, z.array(z.string())]))
const fieldBase = z.object({
  name: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  advanced: z.boolean().optional(),
  advancedIndex: z.number().int().nonnegative().optional(),
  required: z.boolean().optional(),
  inputSchema: schemaObject.optional(),
  presentation: workshopInputDefinitionSchema.optional()
})
const generatedField = z.discriminatedUnion('kind', [
  fieldBase.extend({
    kind: z.literal('text'),
    multiline: z.boolean(),
    required: z.boolean(),
    default: z.string().optional(),
    valueType: z.enum(['string', 'json']).optional(),
    jsonSchema: schemaObject.optional(),
    suggestions: z.array(scalar).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional()
  }),
  fieldBase.extend({
    kind: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.union([z.number().positive(), z.literal('any')]),
    default: z.number().optional()
  }),
  fieldBase.extend({
    kind: z.literal('select'),
    options: z.array(scalar).min(1),
    default: scalar.optional()
  }),
  fieldBase.extend({
    kind: z.literal('toggle'),
    default: z.boolean().optional()
  }),
  fieldBase.extend({
    kind: z.literal('file'),
    accept: z.enum(['image', 'video', 'audio', 'file']),
    mimeTypes: z.array(z.string()).optional(),
    required: z.boolean(),
    multiple: z.boolean().optional(),
    maxItems: z.number().int().positive().optional()
  })
])
const node = z.object({ id: z.string(), displayName: z.string() })
const generatedExample = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailUrl: z.string(),
  mediaKind: z.enum(['image', 'video', 'audio']).optional(),
  sampleOnly: z.boolean().optional(),
  node: node.optional(),
  fields: z.array(generatedField).optional(),
  values: formValues
})
const generatedModel = z.object({
  thumbnailUrl: z.string().optional(),
  provider: z.string().optional(),
  modality: z.enum(MODALITIES).optional(),
  priceUsdFrom: z.number().nonnegative().optional(),
  node: node.extend({ template: z.string() }).optional(),
  fields: z.array(generatedField),
  defaults: formValues,
  examples: z.array(generatedExample)
})

export function decodeGeneratedModels(
  manifest: unknown
): Record<string, GeneratedModel | undefined> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(manifest)
  if (!parsed.success) return {}
  return Object.fromEntries(
    Object.entries(parsed.data).flatMap(([key, raw]) => {
      const entry = generatedModel.safeParse(raw)
      return entry.success ? [[key, entry.data]] : []
    })
  )
}
// makes it image/video/audio-to-X, anything else is text-to-X.
export function taskFor(
  fields: readonly GeneratedField[],
  modality: Modality | undefined
): WorkshopTask {
  const upload = fields.find((field) => field.kind === 'file' && field.required)
  const input: TaskInput =
    upload?.kind === 'file' && upload.accept !== 'file' ? upload.accept : 'text'
  return `${input}-to-${modality ?? 'other'}`
}

export function splitTask(
  task: string
): { input: TaskInput; output: Exclude<ModalityFilter, 'all'> } | undefined {
  const [rawInput, rawOutput, ...rest] = task.split('-to-')
  if (rest.length > 0) return undefined
  const input = TASK_INPUTS.find((value) => value === rawInput)
  const output = MODALITY_FILTERS.find((value) => value === rawOutput)
  return input && output && output !== 'all' ? { input, output } : undefined
}

// The catalog is organised by what a visitor wants to do: what the model
// produces and, for images and videos, whether it starts from a prompt or
// from existing media. Models with an unknown modality only show up under "All".
// Images lead, then video, then what makes neither: a reading order that holds
// however the counts move.
export const USE_CASES = [
  'generate-images',
  'edit-images',
  'animate-images',
  'generate-videos',
  'edit-videos',
  'text',
  '3d',
  'audio'
] as const
export type UseCase = (typeof USE_CASES)[number]

export function useCaseFor(model: WorkshopModel): UseCase | undefined {
  return useCasesFor(model)[0]
}

export function useCasesFor(model: WorkshopModel): readonly UseCase[] {
  if (model.useCases?.length) return model.useCases
  const input = model.task ? splitTask(model.task)?.input : undefined
  switch (model.modality) {
    case 'image':
      return [input === 'image' ? 'edit-images' : 'generate-images']
    case 'video':
      return [
        input === 'image'
          ? 'animate-images'
          : input === 'video'
            ? 'edit-videos'
            : 'generate-videos'
      ]
    case '3d':
    case 'audio':
    case 'text':
      return [model.modality]
    default:
      return []
  }
}

// Example tags that say what a model can do beyond its use case. Tags that
// only repeat the modality or the task are left out.
const CAPABILITY_LABELS: Readonly<Record<string, string | undefined>> = {
  'Image Upscale': 'Upscale',
  'Video Upscale': 'Upscale',
  'Image Edit': 'Image editing',
  'Video Edit': 'Video editing',
  Inpainting: 'Inpainting',
  Outpainting: 'Outpainting',
  'Lip Sync': 'Lip sync',
  FLF2V: 'First and last frame',
  'Reference to Video': 'Reference video',
  'Style Reference': 'Style reference',
  'Character Reference': 'Character reference',
  'Motion Control': 'Motion control',
  Relight: 'Relighting',
  'Virtual Try-On': 'Virtual try-on',
  Vector: 'Vector output',
  'Text to Speech': 'Text to speech',
  'Voice Cloning': 'Voice cloning',
  Music: 'Music',
  'Text to Music': 'Music'
}

// A family's simulated releases inherit the templates of the model they were
// derived from, which lands video capabilities on an image model and the other
// way round. What a model puts out is the one thing we know first-hand, so it
// decides which of the inherited labels may stand.
const CAPABILITY_MODALITY: Readonly<
  Record<string, 'image' | 'video' | undefined>
> = {
  'Image editing': 'image',
  Inpainting: 'image',
  Outpainting: 'image',
  Relighting: 'image',
  'Virtual try-on': 'image',
  'Video editing': 'video',
  'First and last frame': 'video',
  'Reference video': 'video',
  'Motion control': 'video',
  'Lip sync': 'video'
}

export function capabilitiesFor(
  examples: readonly GeneratedExample[],
  modality?: string
): string[] {
  const labels = examples.flatMap((example) =>
    example.tags.flatMap((tag) => CAPABILITY_LABELS[tag] ?? [])
  )
  const fits = (label: string) => {
    const wanted = CAPABILITY_MODALITY[label]
    return wanted === undefined || modality === undefined || wanted === modality
  }
  return [...new Set(labels)].filter(fits).sort()
}

// The templates already describe what each model does, in Comfy's own words.
// One sentence is a label, so a short second one comes along when it fits.
const SUMMARY_MAX = 200

export function summaryFor(
  examples: readonly GeneratedExample[]
): string | undefined {
  const description = examples[0]?.description.trim()
  if (!description) return undefined
  const sentences = description.match(/[^.!?]+[.!?]+/g) ?? [description]
  const first = sentences.at(0) ?? description
  const pair = `${first}${sentences.at(1) ?? ''}`.trim()
  return pair.length <= SUMMARY_MAX ? pair : first.trim()
}

export function isRouterModel(model: Model): boolean {
  return (
    model.directory === 'partner_nodes' && model.canonicalSlug === undefined
  )
}

export const workshopModels: readonly WorkshopModel[] = routerWorkshopModels

export function getWorkshopModel(slug: string): WorkshopModel | undefined {
  const canonical = routerModelSlugAliases.get(slug) ?? slug
  return workshopModels.find((model) => model.slug === canonical)
}

export function modalityOf(
  model: WorkshopModel
): Exclude<ModalityFilter, 'all'> {
  return model.modality ?? 'other'
}

export interface WorkshopFilter {
  readonly query?: string
  readonly useCase?: UseCase | 'all' | 'other'
  readonly modalities?: readonly string[]
  readonly providers?: readonly string[]
  readonly capabilities?: readonly string[]
}

// 'other' is the shelf that holds text, 3D and audio at once.
function matchesUseCase(
  useCase: UseCase | 'all' | 'other',
  model: WorkshopModel
): boolean {
  if (useCase === 'all') return true
  const modelUseCases = useCasesFor(model)
  return useCase === 'other'
    ? modelUseCases.some((value) => OTHER_FORMAT_USE_CASES.includes(value))
    : modelUseCases.includes(useCase)
}

function matchesFacet(
  selected: readonly string[],
  value: string | undefined
): boolean {
  return (
    selected.length === 0 || (value !== undefined && selected.includes(value))
  )
}

// Deep links into the catalog: `?useCase=edit-images&capability=Upscale&provider=Kling`.
export function catalogSearch(filter: Partial<WorkshopFilter>): string {
  const params = new URLSearchParams()
  if (filter.query) params.set('q', filter.query)
  if (filter.useCase && filter.useCase !== 'all')
    params.set('useCase', filter.useCase)
  for (const capability of filter.capabilities ?? [])
    params.append('capability', capability)
  for (const provider of filter.providers ?? [])
    params.append('provider', provider)
  for (const modality of filter.modalities ?? [])
    params.append('modality', modality)
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function parseCatalogSearch(search: string): WorkshopFilter {
  const params = new URLSearchParams(search)
  const useCase = params.get('useCase')
  return {
    query: params.get('q') ?? '',
    useCase:
      USE_CASES.find((value) => value === useCase) ??
      (useCase === 'other' ? 'other' : 'all'),
    capabilities: params.getAll('capability'),
    providers: params.getAll('provider'),
    modalities: params.getAll('modality')
  }
}

export function filterWorkshopModels(
  list: readonly WorkshopModel[],
  {
    query = '',
    useCase = 'all',
    modalities = [],
    providers = [],
    capabilities = []
  }: WorkshopFilter
): WorkshopModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      matchesUseCase(useCase, model) &&
      (modalities.length === 0 ||
        (model.modalities ?? [modalityOf(model)]).some((modality) =>
          modalities.includes(modality)
        )) &&
      matchesFacet(providers, model.provider) &&
      (capabilities.length === 0 ||
        capabilities.some((value) => model.capabilities.includes(value))) &&
      (needle === '' || searchText(model).includes(needle))
  )
}

// Name, provider, use case ("generate videos"), capabilities ("upscale"),
// category and task ("image to video") are all searchable.
function searchText(model: WorkshopModel): string {
  return [
    model.name,
    model.provider ?? '',
    ...useCasesFor(model).map((value) => value.replaceAll('-', ' ')),
    ...model.capabilities,
    modalityOf(model),
    model.task?.replaceAll('-', ' ') ?? ''
  ]
    .join(' ')
    .toLowerCase()
}

export const SORT_ORDERS = ['popular', 'name', 'priceAsc', 'priceDesc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export function sortWorkshopModels(
  list: readonly WorkshopModel[],
  order: SortOrder
): WorkshopModel[] {
  const byName = (a: WorkshopModel, b: WorkshopModel) =>
    a.name.localeCompare(b.name)
  const compare: Record<
    SortOrder,
    (a: WorkshopModel, b: WorkshopModel) => number
  > = {
    popular: (a, b) => b.workflowCount - a.workflowCount || byName(a, b),
    name: byName,
    priceAsc: (a, b) =>
      (a.creditsPerRun ?? Number.POSITIVE_INFINITY) -
        (b.creditsPerRun ?? Number.POSITIVE_INFINITY) || byName(a, b),
    priceDesc: (a, b) =>
      (b.creditsPerRun ?? -1) - (a.creditsPerRun ?? -1) || byName(a, b)
  }
  return [...list].sort(compare[order])
}

export interface FacetOption {
  readonly value: string
  readonly count: number
}

export function countByFacet(
  list: readonly WorkshopModel[],
  facet: 'provider' | 'capabilities'
): FacetOption[] {
  const counts = new Map<string, number>()
  for (const model of list) {
    const raw = model[facet]
    const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

// The models list browses by what a model makes; the workflows hub browses by
// use case, where the volume makes "edit" and "animate" worth splitting out.
export function countByModality(
  list: readonly WorkshopModel[]
): Record<ModalityFilter, number> {
  const counts = Object.fromEntries(
    MODALITY_FILTERS.map((value) => [value, 0])
  ) as Record<ModalityFilter, number>
  for (const model of list) {
    counts.all += 1
    for (const modality of new Set(model.modalities ?? [modalityOf(model)]))
      counts[modality] += 1
  }
  return counts
}

export function countByUseCase(
  list: readonly WorkshopModel[]
): Record<UseCase | 'all', number> {
  const counts = Object.fromEntries(
    ['all', ...USE_CASES].map((useCase) => [useCase, 0])
  ) as Record<UseCase | 'all', number>
  for (const model of list) {
    counts.all += 1
    for (const useCase of useCasesFor(model)) counts[useCase] += 1
  }
  return counts
}
