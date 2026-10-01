import type { UseCase } from '../../config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '../../config/workshop-sections'
import type { TranslationKey } from '../../i18n/translations'
import { useCaseLabelKey } from './use-case-label'

/**
 * What to call the screen a set of use cases opens.
 *
 * One use case names its own screen. The three other-format ones together are
 * the shelf they are browsed from. Any other combination has no single name,
 * so the catalogue's own is the honest one.
 */
export function sectionTitleKeyFor(
  selected: readonly UseCase[]
): TranslationKey {
  if (selected.length === 1) return useCaseLabelKey[selected[0]]
  const chosen = new Set(selected)
  return chosen.size === OTHER_FORMAT_USE_CASES.length &&
    OTHER_FORMAT_USE_CASES.every((useCase) => chosen.has(useCase))
    ? 'workshop.sections.otherFormats'
    : 'workshop.sections.allModels'
}
