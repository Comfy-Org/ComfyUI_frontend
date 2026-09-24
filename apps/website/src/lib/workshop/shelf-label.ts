import { USE_CASES } from '../../config/models-catalogue'
import { LAUNCH_CATEGORY_NAMES } from '../../config/launch-categories'
import type { TranslationKey } from '../../i18n/translations'
import { useCaseLabelKey } from './use-case-label'

// The two halves shelve by different axes, and a remembered shelf or a link
// carries only its key. Both axes answer here so neither caller has to know
// which one it came from.
const LABELS = new Map<string, TranslationKey>([
  ...USE_CASES.map((useCase) => [useCase, useCaseLabelKey[useCase]] as const),
  ...LAUNCH_CATEGORY_NAMES.map(
    (category) => [category.key, category.labelKey] as const
  )
])

export function shelfLabelKey(key: string): TranslationKey | undefined {
  return LABELS.get(key)
}
