import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { words } from './model-summary'
import { splitPriceLabel } from './price-label'

const META_DESCRIPTION_TARGET = 160
const META_DESCRIPTION_MAX = 170
const SINGLE_CREDIT_FIGURE = /^(~?\d+(?:\.\d+)?) credits$/

function nameCarriesProvider(name: string, provider: string) {
  const nameWords = new Set(words(name))
  return words(provider).every((word) => nameWords.has(word))
}

function cutAtWord(text: string, maxLength: number) {
  const cut = text
    .slice(0, Math.max(0, maxLength - 1))
    .replace(/[\uD800-\uDBFF]$/, '')
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`
}

function cleanSummary(summary: string | undefined) {
  return summary?.replace(/`([^`]*)`/g, '$1').replace(/(?<![.!?。！？])$/u, '.')
}

function priceClause(priceEstimate: string | undefined, locale: Locale) {
  if (!priceEstimate) return undefined
  const { amount, per } = splitPriceLabel(priceEstimate)
  const credits = amount.match(SINGLE_CREDIT_FIGURE)?.[1]
  if (!credits) return undefined
  const unit = per?.slice(1).toLowerCase()
  return unit
    ? t('workshop.model.meta.price', locale, { credits, unit })
    : t('workshop.model.meta.priceNoUnit', locale, { credits })
}

export function modelMetaDescription(
  page: {
    model: { name: string; provider?: string; summary?: string }
    priceEstimate?: string
  },
  locale: Locale = 'en'
) {
  const { name, provider } = page.model
  const summary = cleanSummary(page.model.summary)
  const who =
    provider && !nameCarriesProvider(name, provider)
      ? t('workshop.model.meta.byProvider', locale, { name, provider })
      : name
  const lead = (shown: string | undefined) =>
    shown
      ? t('workshop.model.meta.lead', locale, { who, summary: shown })
      : t('workshop.model.meta.leadNoSummary', locale, { who })
  const compose = (...parts: (string | undefined)[]) =>
    parts.filter(Boolean).join(locale === 'en' ? ' ' : '')
  const price = priceClause(page.priceEstimate, locale)
  const cta = t('workshop.model.meta.cta', locale)
  const ctaShort = t('workshop.model.meta.ctaShort', locale)

  const fitting =
    [
      compose(lead(summary), cta, price),
      compose(lead(summary), ctaShort, price),
      compose(lead(summary), price)
    ].find((text) => text.length <= META_DESCRIPTION_TARGET) ??
    [compose(lead(summary), price), lead(summary)].find(
      (text) => text.length <= META_DESCRIPTION_MAX
    )
  if (fitting) return fitting
  const overflow = lead(summary).length - META_DESCRIPTION_MAX
  const cut =
    summary && summary.length > overflow
      ? lead(cutAtWord(summary, summary.length - overflow))
      : lead(summary)
  return cut.length <= META_DESCRIPTION_MAX
    ? cut
    : cutAtWord(cut, META_DESCRIPTION_MAX)
}
