import { catalogSearch, useCaseFor } from '../../config/models-catalogue'
import { getWorkshopModel } from '../../config/workshop-browse-content'
import {
  getWorkshopPageDetail,
  workshopPages
} from '../../config/workshop-page-content'
import { relatedModels } from '../../config/workshop-related'
import { estimateWorkshopNodePrice } from '../../config/workshop-node-pricing'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const TAGS_SHOWN = 3

function splitShownTags<T>(tags: readonly T[]) {
  const shownTags = tags.slice(0, TAGS_SHOWN)
  const restTags = tags.slice(TAGS_SHOWN)
  return { shownTags, restTags, restTagCount: restTags.length }
}

export async function prepareModelPage(
  slug: string | undefined,
  locale: Locale = 'en'
) {
  const model = slug ? getWorkshopPageDetail(slug) : undefined
  if (!model) throw new Error(`Unknown Models route: ${slug ?? '(missing)'}`)
  if (slug !== model.slug)
    return { kind: 'redirect', href: model.href } as const
  const related = relatedModels(
    model,
    workshopPages.filter(
      (other) => (other.type ?? 'MODEL') === (model.type ?? 'MODEL')
    )
  )
  const useCase = useCaseFor(model)
  const relatedProvider =
    related.length > 0 &&
    related.every((other) => other.provider === model.provider)
      ? model.provider
      : undefined
  const tags = model.capabilities.map((capability) => ({
    label: capability,
    search: catalogSearch({ query: capability })
  }))
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
    useCaseLabel: useCase ? t(useCaseLabelKey[useCase], locale) : undefined,
    tags,
    ...splitShownTags(tags)
  }
}
