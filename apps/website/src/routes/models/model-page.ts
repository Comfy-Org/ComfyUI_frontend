import {
  catalogSearch,
  getWorkshopModel,
  workshopModels
} from '../../config/models-catalogue'
import { getRouterWorkshopModelDetail } from '../../config/workshop-router-content'
import { relatedModels } from '../../config/workshop-related'
import { estimateWorkshopNodePrice } from '../../config/workshop-node-pricing'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

export async function prepareModelPage(
  slug: string | undefined,
  locale: Locale = 'en'
) {
  const model = slug ? getRouterWorkshopModelDetail(slug) : undefined
  if (!model) throw new Error(`Unknown Models route: ${slug ?? '(missing)'}`)
  if (slug !== model.slug)
    return { kind: 'redirect', href: model.href } as const
  const related = relatedModels(model, workshopModels)
  const relatedProvider =
    related.length > 0 &&
    related.every((other) => other.provider === model.provider)
      ? model.provider
      : undefined
  return {
    kind: 'page' as const,
    model,
    related,
    relatedHeading: relatedProvider
      ? t('workshop.model.relatedProvider', locale).replace(
          '{provider}',
          relatedProvider
        )
      : t('workshop.model.related', locale),
    relatedHeadingShort: t('workshop.model.relatedShort', locale),
    successor: model.successorSlug
      ? getWorkshopModel(model.successorSlug)
      : undefined,
    priceEstimate: await estimateWorkshopNodePrice(
      model,
      model.useCases?.length === 1 ? model.useCases[0] : undefined
    ),
    modalityLabel: {
      image: t('workshop.filter.image', locale),
      video: t('workshop.filter.video', locale),
      audio: t('workshop.filter.audio', locale),
      '3d': t('workshop.filter.3d', locale),
      text: t('workshop.filter.text', locale)
    },
    tags: model.capabilities.map((capability) => ({
      label: capability,
      search: catalogSearch({ capabilities: [capability] })
    }))
  }
}
