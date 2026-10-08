import type { UseCase } from '@/config/models-catalogue'
import { catalogSearch } from '@/config/models-catalogue'
import { getRoutes } from '@/config/routes'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ModelAccess } from './explorer/model-access'
import { ACCESS_PARAM } from './explorer/model-access'
import type { ModelTab } from './explorer/model-tabs'
import { MODEL_TAB_PARAM } from './explorer/model-tabs'
import type { ListReturn } from './shelf-memory'
import { shelfOf } from './shelf-use-cases'
import { useCaseLabelKey } from './use-case-label'

export interface ModelsListState {
  readonly query: string
  readonly useCases: readonly UseCase[]
  readonly tab: ModelTab
  readonly access: readonly ModelAccess[]
}

export const tabListKey: Record<Exclude<ModelTab, 'all'>, TranslationKey> = {
  image: 'workshop.modelsHub.back.tab.image',
  video: 'workshop.modelsHub.back.tab.video',
  audio: 'workshop.modelsHub.back.tab.audio',
  '3d': 'workshop.modelsHub.back.tab.3d',
  edit: 'workshop.modelsHub.back.tab.edit',
  upscale: 'workshop.modelsHub.back.tab.upscale',
  llm: 'workshop.modelsHub.back.tab.llm',
  open: 'workshop.modelsHub.back.tab.open',
  partner: 'workshop.modelsHub.back.tab.partner'
}

const accessListKey: Record<ModelAccess, TranslationKey> = {
  run: 'workshop.modelsHub.back.access.run',
  api: 'workshop.modelsHub.back.access.api',
  download: 'workshop.modelsHub.back.access.download'
}

/**
 * The Models list as the visitor narrowed it, addressed and named for the
 * way back from a model opened in it: the search first, then the category,
 * the tab and the one way of using a model they picked.
 */
export function modelsListReturn(
  { query, useCases, tab, access }: ModelsListState,
  locale: Locale
): ListReturn {
  const { t } = translationsFor(locale)
  const needle = query.trim()
  const shelf = shelfOf(useCases)
  const params = new URLSearchParams(
    catalogSearch({ query: needle, useCase: shelf })
  )
  if (tab !== 'all') params.set(MODEL_TAB_PARAM, tab)
  if (access.length) params.set(ACCESS_PARAM, access.join(','))
  const search = params.toString()
  const href = `${getRoutes(locale).workshop}${search ? `?${search}` : ''}`

  const label = needle
    ? t('workshop.modelsHub.back.search', { query: needle })
    : shelf !== 'all'
      ? t(useCaseLabelKey[shelf])
      : tab !== 'all'
        ? t(tabListKey[tab])
        : access.length === 1
          ? t(accessListKey[access[0]])
          : undefined
  return label === undefined ? { href } : { href, label }
}
