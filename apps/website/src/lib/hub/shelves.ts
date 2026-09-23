import { USE_CASES } from '../../config/models-catalogue'
import { LAUNCH_CATEGORIES } from '../../config/workshop-launch'
import type { TranslationKey } from '../../i18n/translations'
import { useCaseLabelKey } from '../workshop/use-case-label'
import type { TypeFilter } from './browse-entry'

/** One row of the catalogue at rest, named for the reader. */
export interface CatalogueShelf {
  readonly key: string
  readonly labelKey: TranslationKey
}

const MODEL_SHELVES: readonly CatalogueShelf[] = USE_CASES.map((useCase) => ({
  key: useCase,
  labelKey: useCaseLabelKey[useCase]
}))

const WORKFLOW_SHELVES: readonly CatalogueShelf[] = LAUNCH_CATEGORIES.map(
  (category) => ({ key: category.key, labelKey: category.labelKey })
)

/**
 * The two halves are read through different axes. A model answers "what can I
 * make", so its shelves are use cases. A workflow answers "which job", so its
 * shelves are the launch spec's categories, in the order the spec sets.
 */
export function shelvesFor(type: TypeFilter): readonly CatalogueShelf[] {
  return type === 'workflow' ? WORKFLOW_SHELVES : MODEL_SHELVES
}
