import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { taskLabelFor } from '@/lib/workshop/task-label'
import { accessBadgeKey, accessFor } from './model-access'

export const MAX_COMPARED = 3
export const MIN_COMPARED = 2
export const COMPARE_HASH = '#compare'

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
