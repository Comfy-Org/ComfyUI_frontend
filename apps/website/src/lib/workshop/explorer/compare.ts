import type { WorkshopModel } from '@/config/models-catalogue'
import { sortWorkshopModels } from '@/config/models-catalogue'
import { SAME_PROMPT_SAMPLES } from '@/data/compareSamePrompt'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { taskLabelFor } from '@/lib/workshop/task-label'
import { accessBadgeKey, accessFor } from './model-access'
import { sharesSamples } from './same-prompt'

export const MAX_COMPARED = 4
export const MIN_COMPARED = 2
/** The compare view's models, kept in the address as `?compare=a,b`. */
const COMPARE_PARAM = 'compare'

export function canCompare(model: WorkshopModel): boolean {
  return accessFor(model).length > 0 && !model.incompleteReason
}

export function toggleCompared(
  selected: readonly string[],
  slug: string
): readonly string[] {
  if (selected.includes(slug)) return selected.filter((s) => s !== slug)
  return selected.length < MAX_COMPARED ? [...selected, slug] : selected
}

const COMPARE_FIELDS = ['provider', 'task', 'access'] as const
type CompareField = (typeof COMPARE_FIELDS)[number]

const fieldLabelKey: Record<CompareField, TranslationKey> = {
  provider: 'workshop.explorer.compare.provider',
  task: 'workshop.explorer.compare.task',
  access: 'workshop.explorer.compare.access'
}

export interface CompareRow {
  readonly key: CompareField
  readonly label: TranslationKey
  readonly values: readonly string[]
}

export function compareRows(
  models: readonly WorkshopModel[],
  locale: Locale
): readonly CompareRow[] {
  const { t } = translationsFor(locale)
  const read: Record<CompareField, (model: WorkshopModel) => string> = {
    provider: (model) => model.provider ?? '—',
    task: (model) => taskLabelFor(model, locale),
    access: (model) =>
      accessFor(model)
        .map((value) => t(accessBadgeKey[value]))
        .join(' · ') || '—'
  }
  return COMPARE_FIELDS.map((key) => ({
    key,
    label: fieldLabelKey[key],
    values: models.map(read[key])
  }))
}

export function parseCompared(search: string): readonly string[] {
  const named = new URLSearchParams(search).get(COMPARE_PARAM)?.split(',')
  return [...new Set(named?.filter(Boolean))].slice(0, MAX_COMPARED)
}

export function comparedSearch(
  search: string,
  slugs: readonly string[]
): string {
  const params = new URLSearchParams(search)
  if (slugs.length) params.set(COMPARE_PARAM, slugs.join(','))
  else params.delete(COMPARE_PARAM)
  const next = params.toString().replaceAll('%2C', ',')
  return next ? `?${next}` : ''
}

/**
 * The models a model page offers to compare with: others that do the same
 * task (the same input to the same output), those that answered a prompt this
 * model also answered first, then the most popular.
 */
export function comparableWith(
  model: WorkshopModel,
  catalogue: readonly WorkshopModel[],
  samples = SAME_PROMPT_SAMPLES,
  limit = MAX_COMPARED - 1
): WorkshopModel[] {
  if (!canCompare(model) || !model.task) return []
  const popular = sortWorkshopModels(
    catalogue.filter(
      (other) =>
        other.slug !== model.slug &&
        other.task === model.task &&
        canCompare(other)
    ),
    'popular'
  )
  const sharing = popular.filter((other) =>
    sharesSamples(samples, model.slug, other.slug)
  )
  return [
    ...sharing,
    ...popular.filter((other) => !sharing.includes(other))
  ].slice(0, limit)
}
