import type { Model } from './models'
import { models } from './models'
import displayOverrides from './workshop-model-display.json'
import generatedModels from './workshop-models.generated.json'
import { usdToCredits } from './credits'

const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

const MODALITY_FILTERS = ['all', ...MODALITIES, 'other'] as const
export type ModalityFilter = (typeof MODALITY_FILTERS)[number]

export type ModelStatus = 'deprecated' | 'degraded'

const TASK_INPUTS = ['text', 'image', 'video', 'audio'] as const
type TaskInput = (typeof TASK_INPUTS)[number]
export type WorkshopTask = `${TaskInput}-to-${Exclude<ModalityFilter, 'all'>}`

// Hand-maintained overrides on top of workshop-models.generated.json:
// status flags Router does not report and fallbacks for models the
// generator could not resolve. Prices here are placeholders.
interface WorkshopModelDisplay {
  readonly provider?: string
  readonly modality?: Modality
  readonly creditsPerRun?: number
  readonly status?: ModelStatus
  readonly successorSlug?: string
}

export type GeneratedField =
  | {
      readonly kind: 'text'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly multiline: boolean
      readonly required: boolean
      readonly default?: string
    }
  | {
      readonly kind: 'number'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly default: number
    }
  | {
      readonly kind: 'select'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly options: readonly string[]
      readonly default: string
    }
  | {
      readonly kind: 'toggle'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly default: boolean
    }
  | {
      readonly kind: 'file'
      readonly name: string
      readonly label: string
      readonly hint?: string
      readonly accept: 'image' | 'video' | 'audio'
      readonly required: boolean
    }

export interface GeneratedExample {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly tags: readonly string[]
  readonly thumbnailUrl: string
  readonly node?: { readonly id: string; readonly displayName: string }
  readonly fields?: readonly GeneratedField[]
  readonly values: Readonly<Record<string, string | number | boolean>>
}

interface GeneratedModel {
  readonly thumbnailUrl?: string
  readonly provider?: string
  readonly modality?: Modality
  readonly priceUsdFrom?: number
  readonly node?: { id: string; displayName: string; template: string }
  readonly fields: readonly GeneratedField[]
  readonly defaults: Readonly<Record<string, string | number | boolean>>
  readonly examples: readonly GeneratedExample[]
}

export interface WorkshopModel {
  readonly slug: string
  readonly name: string
  readonly workflowCount: number
  readonly href: string
  readonly routerId: string
  readonly provider?: string
  readonly modality?: Modality
  readonly task?: WorkshopTask
  readonly capabilities: readonly string[]
  readonly runs: number
  readonly creditsPerRun?: number
  readonly priceUsdFrom?: number
  readonly thumbnailUrl?: string
  readonly status?: ModelStatus
  readonly successorSlug?: string
}

export interface WorkshopModelDetail extends WorkshopModel {
  readonly nodeDisplayName?: string
  readonly fields: readonly GeneratedField[]
  readonly defaults: Readonly<Record<string, string | number | boolean>>
  readonly examples: readonly GeneratedExample[]
}

const display = displayOverrides as Record<string, WorkshopModelDisplay>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isFormValue(value: unknown): value is string | number | boolean {
  return isString(value) || isFiniteNumber(value) || isBoolean(value)
}

function isFormValues(
  value: unknown
): value is Record<string, string | number | boolean> {
  return isRecord(value) && Object.values(value).every(isFormValue)
}

const UPLOAD_ACCEPTS: ReadonlySet<unknown> = new Set([
  'image',
  'video',
  'audio'
])

function isGeneratedField(value: unknown): value is GeneratedField {
  if (!isRecord(value) || !isString(value.name) || !isString(value.label))
    return false
  if (value.hint !== undefined && !isString(value.hint)) return false
  switch (value.kind) {
    case 'text':
      return (
        isBoolean(value.multiline) &&
        isBoolean(value.required) &&
        (value.default === undefined || isString(value.default))
      )
    case 'number':
      return (
        isFiniteNumber(value.min) &&
        isFiniteNumber(value.max) &&
        isFiniteNumber(value.step) &&
        isFiniteNumber(value.default)
      )
    case 'select':
      return (
        Array.isArray(value.options) &&
        value.options.every(isString) &&
        isString(value.default)
      )
    case 'toggle':
      return isBoolean(value.default)
    case 'file':
      return UPLOAD_ACCEPTS.has(value.accept) && isBoolean(value.required)
    default:
      return false
  }
}

function isGeneratedExample(value: unknown): value is GeneratedExample {
  return (
    isRecord(value) &&
    isString(value.name) &&
    isString(value.title) &&
    isString(value.description) &&
    isString(value.thumbnailUrl) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isFormValues(value.values) &&
    (value.node === undefined ||
      (isRecord(value.node) &&
        isString(value.node.id) &&
        isString(value.node.displayName))) &&
    (value.fields === undefined ||
      (Array.isArray(value.fields) && value.fields.every(isGeneratedField)))
  )
}

function isGeneratedModel(value: unknown): value is GeneratedModel {
  return (
    isRecord(value) &&
    Array.isArray(value.fields) &&
    value.fields.every(isGeneratedField) &&
    isFormValues(value.defaults) &&
    Array.isArray(value.examples) &&
    value.examples.every(isGeneratedExample)
  )
}

// Records the generator wrote in a shape the catalog cannot render are
// dropped here rather than crashing a model page.
export function decodeGeneratedModels(
  manifest: unknown
): Record<string, GeneratedModel> {
  if (typeof manifest !== 'object' || manifest === null) return {}
  return Object.fromEntries(
    Object.entries(manifest).filter(
      (entry): entry is [string, GeneratedModel] => isGeneratedModel(entry[1])
    )
  )
}

const generated = decodeGeneratedModels(generatedModels)

function modelDetailHref(slug: string): string {
  return `/workshop/models/${slug}/`
}

// Router ids are `{provider}/{model}`; the registry only knows the slug, so
// the provider half is derived from display metadata until Router serves it.
function routerIdFor(slug: string, provider?: string): string {
  const providerSlug = (provider ?? 'comfy')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${providerSlug}/${slug}`
}

// The task is the model's primary input to its output: a required upload
// makes it image/video/audio-to-X, anything else is text-to-X.
export function taskFor(
  fields: readonly GeneratedField[],
  modality: Modality | undefined
): WorkshopTask {
  const upload = fields.find((field) => field.kind === 'file' && field.required)
  const input: TaskInput = upload?.kind === 'file' ? upload.accept : 'text'
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

// The catalog is organised by what a model produces. Models with an unknown
// modality only show up under "All".
export const USE_CASES = ['image', 'video', '3d', 'audio', 'text'] as const
export type UseCase = (typeof USE_CASES)[number]

export function useCaseFor(model: WorkshopModel): UseCase | undefined {
  return USE_CASES.find((value) => value === model.modality)
}

// Example tags that say what a model can do beyond its use case. Tags that
// only repeat the modality or the task are left out.
const CAPABILITY_LABELS: Readonly<Record<string, string>> = {
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

export function capabilitiesFor(
  examples: readonly GeneratedExample[]
): string[] {
  const labels = examples.flatMap((example) =>
    example.tags.flatMap((tag) => CAPABILITY_LABELS[tag] ?? [])
  )
  return [...new Set(labels)].sort()
}

// The registry names some models "Model (Provider)" or "Model (API)"; the
// card already shows the provider, and every Workshop model runs via API.
function withoutRegistrySuffix(name: string, provider?: string): string {
  const suffixes = ['(API)', ...(provider ? [`(${provider})`] : [])]
  const suffix = suffixes.find((candidate) => name.endsWith(candidate))
  return suffix ? name.slice(0, -suffix.length).trim() : name
}

// Router does not report usage yet; until it does, each model gets a stable
// placeholder derived from its slug and workflow count.
export function mockRuns(slug: string, workflowCount: number): number {
  let seed = 7
  for (let i = 0; i < slug.length; i += 1)
    seed = (seed * 31 + slug.charCodeAt(i)) % 1_000_003
  return (workflowCount + 1) * (4000 + (seed % 37) * 1000)
}

export function formatRuns(runs: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  })
    .format(runs)
    .toLowerCase()
}

function toWorkshopModel(model: Model): WorkshopModel {
  const overrides = display[model.slug] ?? {}
  const data = generated[model.slug]
  const provider = overrides.provider ?? data?.provider
  const modality = overrides.modality ?? data?.modality
  const creditsPerRun =
    data?.priceUsdFrom !== undefined
      ? usdToCredits(data.priceUsdFrom)
      : overrides.creditsPerRun
  return {
    slug: model.slug,
    name: withoutRegistrySuffix(model.displayName, provider),
    workflowCount: model.workflowCount,
    href: modelDetailHref(model.slug),
    routerId: routerIdFor(model.slug, provider),
    ...(provider ? { provider } : {}),
    ...(modality ? { modality } : {}),
    ...(data ? { task: taskFor(data.fields, modality) } : {}),
    capabilities: capabilitiesFor(data?.examples ?? []),
    runs: mockRuns(model.slug, model.workflowCount),
    ...(creditsPerRun !== undefined ? { creditsPerRun } : {}),
    ...(data?.priceUsdFrom !== undefined
      ? { priceUsdFrom: data.priceUsdFrom }
      : {}),
    ...(data?.thumbnailUrl ? { thumbnailUrl: data.thumbnailUrl } : {}),
    ...(overrides.status ? { status: overrides.status } : {}),
    ...(overrides.successorSlug
      ? { successorSlug: overrides.successorSlug }
      : {})
  }
}

export function isRouterModel(model: Model): boolean {
  return (
    model.directory === 'partner_nodes' && model.canonicalSlug === undefined
  )
}

export const workshopModels: readonly WorkshopModel[] = models
  .filter(isRouterModel)
  .map(toWorkshopModel)

export function getWorkshopModel(slug: string): WorkshopModel | undefined {
  return workshopModels.find((model) => model.slug === slug)
}

export function getWorkshopModelDetail(
  slug: string
): WorkshopModelDetail | undefined {
  const model = getWorkshopModel(slug)
  if (!model) return undefined
  const data = generated[slug]
  return {
    ...model,
    ...(data?.node ? { nodeDisplayName: data.node.displayName } : {}),
    fields: data?.fields ?? [],
    defaults: data?.defaults ?? {},
    examples: data?.examples ?? []
  }
}

export function modalityOf(
  model: WorkshopModel
): Exclude<ModalityFilter, 'all'> {
  return model.modality ?? 'other'
}

export interface WorkshopFilter {
  readonly query: string
  readonly useCase?: UseCase | 'all'
  readonly providers?: readonly string[]
  readonly capabilities?: readonly string[]
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
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function parseCatalogSearch(search: string): WorkshopFilter {
  const params = new URLSearchParams(search)
  const useCase = params.get('useCase')
  return {
    query: params.get('q') ?? '',
    useCase: USE_CASES.find((value) => value === useCase) ?? 'all',
    capabilities: params.getAll('capability'),
    providers: params.getAll('provider')
  }
}

export function filterWorkshopModels(
  list: readonly WorkshopModel[],
  { query, useCase = 'all', providers = [], capabilities = [] }: WorkshopFilter
): WorkshopModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      (useCase === 'all' || useCaseFor(model) === useCase) &&
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
    useCaseFor(model)?.replaceAll('-', ' ') ?? '',
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

export function countByUseCase(
  list: readonly WorkshopModel[]
): Record<UseCase | 'all', number> {
  const counts = Object.fromEntries(
    ['all', ...USE_CASES].map((useCase) => [useCase, 0])
  ) as Record<UseCase | 'all', number>
  for (const model of list) {
    counts.all += 1
    const useCase = useCaseFor(model)
    if (useCase) counts[useCase] += 1
  }
  return counts
}
