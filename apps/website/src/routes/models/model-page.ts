import type { WorkshopModel } from '../../config/models-catalogue'
import { catalogSearch, useCaseFor } from '../../config/models-catalogue'
import { getWorkshopModel } from '../../config/workshop-browse-content'
import {
  getWorkshopPageDetail,
  workshopPages
} from '../../config/workshop-page-content'
import { relatedModels } from '../../config/workshop-related'
import { estimateWorkshopNodePrice } from '../../config/workshop-node-pricing'
import type { Locale } from '../../i18n/site'
import { t } from '../../i18n/site'
import { describesCapability } from '../../lib/workshop/model-tags'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const TAGS_SHOWN = 3

function splitShownTags<T>(tags: readonly T[]) {
  const shownTags = tags.slice(0, TAGS_SHOWN)
  const restTags = tags.slice(TAGS_SHOWN)
  return { shownTags, restTags, restTagCount: restTags.length }
}

export function modelOgImage(
  model: Pick<WorkshopModel, 'thumbnail'>
): string | undefined {
  return model.thumbnail?.kind === 'image' ? model.thumbnail.url : undefined
}

export async function prepareModelPage(
  slug: string | undefined,
  locale: Locale = 'en'
) {
  const model = slug ? getWorkshopPageDetail(slug) : undefined
  if (!model) throw new Error(`Unknown Models route: ${slug ?? '(missing)'}`)
  const { href } = model
  if (!href)
    throw new Error(
      `Models route ${slug} resolved to ${model.slug}, which has no page`
    )
  if (slug !== model.slug) return { kind: 'redirect', href } as const
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
  const tags = model.capabilities
    .filter((capability) => describesCapability(capability, model))
    .map((capability) => ({
      label: capability,
      search: catalogSearch({ query: capability })
    }))
  return {
    kind: 'page' as const,
    model: { ...model, href },
    related,
    relatedHeading: relatedProvider
      ? t(
          'workshop.model.relatedProvider',
          {
            provider: relatedProvider
          },
          { locale: locale }
        )
      : t('workshop.model.related', {}, { locale: locale }),
    successor: model.successorSlug
      ? getWorkshopModel(model.successorSlug)
      : undefined,
    priceEstimate: await estimateWorkshopNodePrice(
      model,
      model.useCases?.length === 1 ? model.useCases[0] : undefined
    ),
    useCaseLabel: useCase
      ? t(useCaseLabelKey[useCase], {}, { locale: locale })
      : undefined,
    tags,
    ...splitShownTags(tags)
  }
}
