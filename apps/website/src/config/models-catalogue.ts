import type { Model } from './models'
import type { WorkshopFormDefinition } from './workshop-form-definition'
import type { WorkshopContract } from './workshop-contract'
import type { WorkshopInputDefinition } from './workshop-input-definition'
import type { WorkshopWorkflowDefinition } from './workshop-workflow-definition'
import { OTHER_FORMAT_USE_CASES } from './workshop-sections'

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

export interface GeneratedModel {
  readonly thumbnailUrl?: string
  readonly provider?: string
  readonly modality?: Modality
  readonly priceUsdFrom?: number
  readonly node?: { id: string; displayName: string; template: string }
  readonly fields: readonly GeneratedField[]
  readonly defaults: WorkshopExampleValues
  readonly examples: readonly GeneratedExample[]
}

interface WorkshopPresentation {
  readonly slug: string
  readonly name: string
  readonly workflowCount: number
  readonly recommendedRank?: number
  readonly href: string
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

export type RouterWorkshopModel = WorkshopPresentation & {
  readonly type?: 'MODEL'
  readonly routerId: string
  readonly workflowId?: never
}

export type WorkflowWorkshopModel = WorkshopPresentation & {
  readonly categoryLabel?: { readonly en: string; readonly 'zh-CN': string }
  readonly categoryOrder?: number
  readonly categoryHighlight?: boolean
  readonly type: 'CLOUD' | 'SERVERLESS'
  readonly workflowId: string
  readonly routerId?: never
  readonly category?: string
  readonly models?: readonly string[]
  readonly author?: string
}

export type WorkshopModel = RouterWorkshopModel | WorkflowWorkshopModel

interface WorkshopDetailPresentation {
  readonly nodeDisplayName?: string
  readonly form?: WorkshopFormDefinition
  readonly fields: readonly GeneratedField[]
  readonly defaults: WorkshopExampleValues
  readonly examples: readonly GeneratedExample[]
}

export type RouterWorkshopModelDetail = WorkshopDetailPresentation &
  RouterWorkshopModel & {
    readonly execution?: WorkshopContract
    readonly workflow?: never
  }

export type WorkflowWorkshopModelDetail = WorkshopDetailPresentation &
  WorkflowWorkshopModel & {
    readonly execution?: never
    readonly workflow: WorkshopWorkflowDefinition
  }

export type WorkshopModelDetail =
  | RouterWorkshopModelDetail
  | WorkflowWorkshopModelDetail

export function workshopExecutionId(model: WorkshopModel): string {
  return model.routerId ?? model.workflowId
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
  'generate-videos',
  'animate-images',
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

export function modalityOf(
  model: WorkshopModel
): Exclude<ModalityFilter, 'all'> {
  return model.modality ?? 'other'
}

export interface WorkshopFilter {
  readonly query?: string
  readonly useCase?: UseCase | 'all' | 'other'
  readonly useCases?: readonly UseCase[]
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

function matchesUseCases(
  selected: readonly UseCase[],
  model: WorkshopModel
): boolean {
  return (
    selected.length === 0 ||
    selected.some((value) => useCasesFor(model).includes(value))
  )
}

function matchesModalities(
  selected: readonly string[],
  model: WorkshopModel
): boolean {
  return (
    selected.length === 0 ||
    (model.modalities ?? [modalityOf(model)]).some((value) =>
      selected.includes(value)
    )
  )
}

function matchesCapabilities(
  selected: readonly string[],
  model: WorkshopModel
): boolean {
  return (
    selected.length === 0 ||
    selected.some((value) => model.capabilities.includes(value))
  )
}

type CatalogLocation = Pick<WorkshopFilter, 'query' | 'useCase'>

interface ParsedCatalogLocation extends CatalogLocation {
  readonly modalities: readonly string[]
  readonly providers: readonly string[]
  readonly capabilities: readonly string[]
}

// Deep links into the catalog: `?useCase=edit-images&q=upscale`.
export function catalogSearch(filter: CatalogLocation): string {
  const params = new URLSearchParams()
  if (filter.query) params.set('q', filter.query)
  if (filter.useCase && filter.useCase !== 'all')
    params.set('useCase', filter.useCase)
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function parseCatalogSearch(search: string): ParsedCatalogLocation {
  const params = new URLSearchParams(search)
  const useCase = params.get('useCase')
  return {
    query: params.get('q') ?? '',
    useCase:
      USE_CASES.find((value) => value === useCase) ??
      (useCase === 'other' ? 'other' : 'all'),
    modalities: params.getAll('modality').filter(Boolean),
    providers: params.getAll('provider').filter(Boolean),
    capabilities: params.getAll('capability').filter(Boolean)
  }
}

export function filterWorkshopModels(
  list: readonly WorkshopModel[],
  {
    query = '',
    useCase = 'all',
    useCases = [],
    modalities = [],
    providers = [],
    capabilities = []
  }: WorkshopFilter
): WorkshopModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      matchesUseCase(useCase, model) &&
      matchesUseCases(useCases, model) &&
      matchesModalities(modalities, model) &&
      matchesFacet(providers, model.provider) &&
      matchesCapabilities(capabilities, model) &&
      (needle === '' || searchText(model).includes(needle))
  )
}

// Name, provider, use case ("generate videos"), capabilities ("upscale"),
// category and task ("image to video") are all searchable.
function searchText(model: WorkshopModel): string {
  return [
    model.name,
    model.provider ?? '',
    ...(model.routerId === undefined
      ? [model.category ?? '', model.author ?? '', ...(model.models ?? [])]
      : []),
    ...useCasesFor(model).map((value) => value.replaceAll('-', ' ')),
    ...model.capabilities,
    modalityOf(model),
    model.task?.replaceAll('-', ' ') ?? ''
  ]
    .join(' ')
    .toLowerCase()
}

const SORT_ORDERS = ['popular', 'name', 'priceAsc', 'priceDesc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

/**
 * Price orders only mean something where a price exists. Offering them over a
 * list that carries none hands the visitor three controls that all sort by
 * name, so they are withheld until a model brings a price of its own.
 */
export function sortOrdersFor(
  list: readonly WorkshopModel[]
): readonly SortOrder[] {
  return list.some((model) => model.creditsPerRun !== undefined)
    ? SORT_ORDERS
    : SORT_ORDERS.filter(
        (order) => order !== 'priceAsc' && order !== 'priceDesc'
      )
}

export function sortWorkshopModels(
  list: readonly WorkshopModel[],
  order: SortOrder
): WorkshopModel[] {
  const byName = (a: WorkshopModel, b: WorkshopModel) =>
    a.name.localeCompare(b.name)
  const byExamples = (a: WorkshopModel, b: WorkshopModel) =>
    b.workflowCount - a.workflowCount || byName(a, b)
  const byRecommendation = (a: WorkshopModel, b: WorkshopModel) => {
    if (a.recommendedRank !== undefined && b.recommendedRank !== undefined)
      return a.recommendedRank - b.recommendedRank || byExamples(a, b)
    if (a.recommendedRank !== undefined) return -1
    if (b.recommendedRank !== undefined) return 1
    return byExamples(a, b)
  }
  const compare: Record<
    SortOrder,
    (a: WorkshopModel, b: WorkshopModel) => number
  > = {
    popular: byRecommendation,
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
