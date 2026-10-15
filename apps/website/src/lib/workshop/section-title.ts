import type { UseCase } from '@/config/models-catalogue'
import { OTHER_FORMAT_USE_CASES } from '@/config/workshop-sections'
import type { TranslationKey } from '@/i18n/translations'
import type { ModelTab } from './explorer/model-tabs'
import { tabListKey } from './models-list-return'
import { useCaseLabelKey } from './use-case-label'

/**
 * What to call the screen a set of use cases opens.
 *
 * One use case names its own screen. The three other-format ones together are
 * the shelf they are browsed from. With no use case chosen, a category tab
 * names the screen. Any other combination has no single name, so the
 * catalogue's own is the honest one.
 */
export function sectionTitleKeyFor(
  selected: readonly UseCase[],
  tab: ModelTab = 'all'
): TranslationKey {
  if (selected.length === 1) return useCaseLabelKey[selected[0]]
  const chosen = new Set(selected)
  if (
    chosen.size === OTHER_FORMAT_USE_CASES.length &&
    OTHER_FORMAT_USE_CASES.every((useCase) => chosen.has(useCase))
  )
    return 'workshop.sections.otherFormats'
  return !selected.length && tab !== 'all'
    ? tabListKey[tab]
    : 'workshop.sections.allModels'
}
