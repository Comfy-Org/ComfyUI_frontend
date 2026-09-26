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
import { providerName } from '../../lib/workshop/provider-name'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const TAGS_SHOWN = 3
const BARE_VERSION = /^v?\d+(\.\d+)*$/i

function words(value: string): readonly string[] {
  return value.toLowerCase().match(/[a-z]+|\d+/g) ?? []
}

function describesCapability(
  tag: string,
  model: { name: string; provider?: string }
): boolean {
  if (
    BARE_VERSION.test(tag) ||
    providerName(tag.toLowerCase()) === model.provider
  )
    return false
  const tagWords = words(tag)
  return tagWords.length === 0 || !isInOrder(tagWords, words(model.name))
}

function isInOrder(
  needle: readonly string[],
  haystack: readonly string[]
): boolean {
  let next = 0
  for (const word of haystack) if (word === needle[next]) next++
  return next === needle.length
}

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
  const tags = model.capabilities
    .filter((capability) => describesCapability(capability, model))
    .map((capability) => ({
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
