import { interpolate } from '../../config/auth-schemas'
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
import { splitPriceLabel } from '../../lib/workshop/price-label'
import { useCaseLabelKey } from '../../lib/workshop/use-case-label'

const TAGS_SHOWN = 3
const META_DESCRIPTION_TARGET = 160
const META_DESCRIPTION_MAX = 170
const PROVIDER_BRANDS = new Map<string, readonly string[]>([
  ['Black Forest Labs', ['FLUX']],
  ['ByteDance', ['Seedance', 'Seedream']],
  ['Google', ['Nano Banana', 'Veo']]
])

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

function asWords(text: string) {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `
}

function nameCarriesProvider(name: string, provider: string) {
  const nameWords = asWords(name)
  return [provider, ...(PROVIDER_BRANDS.get(provider) ?? [])].some((brand) =>
    nameWords.includes(asWords(brand))
  )
}

function cutAtWord(text: string, maxLength: number) {
  const cut = text
    .slice(0, Math.max(0, maxLength - 1))
    .replace(/[\uD800-\uDBFF]$/, '')
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`
}

function compose(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function metaPriceClause(priceEstimate: string | undefined, locale: Locale) {
  if (!priceEstimate) return undefined
  const { amount, per } = splitPriceLabel(priceEstimate)
  const unit = per?.slice(1).toLowerCase()
  return unit
    ? interpolate(t('workshop.model.meta.price', locale), { amount, unit })
    : interpolate(t('workshop.model.meta.priceNoUnit', locale), { amount })
}

function metaLead(who: string, summary: string | undefined, locale: Locale) {
  return summary
    ? interpolate(t('workshop.model.meta.lead', locale), { who, summary })
    : interpolate(t('workshop.model.meta.leadNoSummary', locale), { who })
}

function fitSummary(
  who: string,
  summary: string | undefined,
  priceClause: string | undefined,
  locale: Locale
) {
  const bare = compose(metaLead(who, summary, locale), priceClause)
  if (bare.length <= META_DESCRIPTION_MAX) return bare
  const summaryRoom =
    (summary?.length ?? 0) - (bare.length - META_DESCRIPTION_MAX)
  const trimmed =
    summary && summaryRoom > 0
      ? compose(
          metaLead(who, cutAtWord(summary, summaryRoom), locale),
          priceClause
        )
      : bare
  return trimmed.length <= META_DESCRIPTION_MAX
    ? trimmed
    : cutAtWord(trimmed, META_DESCRIPTION_MAX)
}

export function modelMetaDescription(
  page: {
    model: { name: string; provider?: string; summary?: string }
    priceEstimate?: string
  },
  locale: Locale = 'en'
) {
  const { name, provider } = page.model
  const summary =
    page.model.summary && page.model.summary.replace(/(?<![.!?。！？])$/u, '.')
  const who =
    provider && !nameCarriesProvider(name, provider)
      ? interpolate(t('workshop.model.meta.byProvider', locale), {
          name,
          provider
        })
      : name
  const lead = metaLead(who, summary, locale)
  const priceClause = metaPriceClause(page.priceEstimate, locale)
  const fitting = [
    t('workshop.model.meta.cta', locale),
    t('workshop.model.meta.ctaShort', locale),
    undefined
  ]
    .map((cta) => compose(lead, cta, priceClause))
    .find((description) => description.length <= META_DESCRIPTION_TARGET)
  return fitting ?? fitSummary(who, summary, priceClause, locale)
}
