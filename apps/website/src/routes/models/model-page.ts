import type { WorkshopModel } from '@/config/models-catalogue'
import { catalogSearch, useCaseFor } from '@/config/models-catalogue'
import { getWorkshopModel } from '@/config/workshop-browse-content'
import {
  getWorkshopPageDetail,
  workshopPages
} from '@/config/workshop-page-content'
import { relatedModels } from '@/config/workshop-related'
import { estimateWorkshopNodePrice } from '@/config/workshop-node-pricing'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { describesCapability } from '@/lib/workshop/model-tags'
import { useCaseLabelKey } from '@/lib/workshop/use-case-label'

const TAGS_SHOWN = 3

function splitShownTags<T>(tags: readonly T[]) {
  const shownTags = tags.slice(0, TAGS_SHOWN)
  const restTags = tags.slice(TAGS_SHOWN)
  return { shownTags, restTags, restTagCount: restTags.length }
}

export function modelOgImage(
  model: Pick<WorkshopModel, 'thumbnail'>
): string | undefined {
  return model.thumbnail?.kind === 'image'
    ? model.thumbnail.url
    : model.thumbnail?.poster
}

type PageCatalog = {
  details: NonNullable<ReturnType<typeof getWorkshopPageDetail>>[]
  models: WorkshopModel[]
}

function pageModel(slug: string | undefined, catalog?: PageCatalog) {
  if (!slug) return undefined
  return catalog
    ? catalog.details.find((item) => item.slug === slug)
    : getWorkshopPageDetail(slug)
}

function successor(model: WorkshopModel, catalog?: PageCatalog) {
  if (!model.successorSlug) return undefined
  return catalog
    ? catalog.models.find((item) => item.slug === model.successorSlug)
    : getWorkshopModel(model.successorSlug)
}

function relatedHeading(
  model: WorkshopModel,
  related: WorkshopModel[],
  t: ReturnType<typeof translationsFor>['t']
) {
  const sameProvider =
    related.length > 0 &&
    related.every((other) => other.provider === model.provider)
  const provider = sameProvider ? model.provider : undefined
  return provider
    ? t('workshop.model.relatedProvider', { provider })
    : t('workshop.model.related')
}

export async function prepareModelPage(
  slug: string | undefined,
  locale: Locale = 'en',
  catalog?: PageCatalog
) {
  const { t } = translationsFor(locale)
  const model = pageModel(slug, catalog)
  if (!model) throw new Error(`Unknown Models route: ${slug ?? '(missing)'}`)
  const { href } = model
  if (!href)
    throw new Error(
      `Models route ${slug} resolved to ${model.slug}, which has no page`
    )
  if (slug !== model.slug) return { kind: 'redirect', href } as const
  const related = relatedModels(
    model,
    (catalog?.models ?? workshopPages).filter(
      (other) => (other.type ?? 'MODEL') === (model.type ?? 'MODEL')
    )
  )
  const useCase = useCaseFor(model)
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
    relatedHeading: relatedHeading(model, related, t),
    successor: successor(model, catalog),
    priceEstimate: await estimateWorkshopNodePrice(
      model,
      model.useCases?.length === 1 ? model.useCases[0] : undefined
    ),
    useCaseLabel: useCase ? t(useCaseLabelKey[useCase]) : undefined,
    tags,
    ...splitShownTags(tags)
  }
}
