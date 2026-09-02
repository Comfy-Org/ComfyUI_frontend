import type { Model } from './models'
import { models } from './models'
import displayOverrides from './workshop-model-display.json'
import generatedModels from './workshop-models.generated.json'
import { usdToCredits } from './credits'

const MODALITIES = ['image', 'video', 'audio', '3d', 'text'] as const
export type Modality = (typeof MODALITIES)[number]

export const MODALITY_FILTERS = ['all', ...MODALITIES, 'other'] as const
export type ModalityFilter = (typeof MODALITY_FILTERS)[number]

export type ModelStatus = 'deprecated' | 'degraded'

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
const generated = generatedModels as unknown as Record<string, GeneratedModel>

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

function toWorkshopModel(model: Model): WorkshopModel {
  const overrides = display[model.slug] ?? {}
  const data = generated[model.slug]
  const provider = overrides.provider ?? data?.provider
  const creditsPerRun =
    data?.priceUsdFrom !== undefined
      ? usdToCredits(data.priceUsdFrom)
      : overrides.creditsPerRun
  return {
    slug: model.slug,
    name: model.displayName,
    workflowCount: model.workflowCount,
    href: modelDetailHref(model.slug),
    routerId: routerIdFor(model.slug, provider),
    ...(provider ? { provider } : {}),
    ...((overrides.modality ?? data?.modality)
      ? { modality: overrides.modality ?? data?.modality }
      : {}),
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
  readonly modality: ModalityFilter
}

export function filterWorkshopModels(
  list: readonly WorkshopModel[],
  { query, modality }: WorkshopFilter
): WorkshopModel[] {
  const needle = query.trim().toLowerCase()
  return list.filter(
    (model) =>
      (modality === 'all' || modalityOf(model) === modality) &&
      (needle === '' ||
        model.name.toLowerCase().includes(needle) ||
        (model.provider?.toLowerCase().includes(needle) ?? false))
  )
}

export function countByModality(
  list: readonly WorkshopModel[]
): Record<ModalityFilter, number> {
  const counts = Object.fromEntries(
    MODALITY_FILTERS.map((filter) => [filter, 0])
  ) as Record<ModalityFilter, number>
  for (const model of list) {
    counts.all += 1
    counts[modalityOf(model)] += 1
  }
  return counts
}
