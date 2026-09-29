import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const TITLE_MAX = 60
const ELLIPSIS = '…'

function shortenAtWord(text: string, max: number) {
  if (text.length <= max) return text
  const limit = max - ELLIPSIS.length
  const wordEnd = text.lastIndexOf(' ', limit)
  return `${text.slice(0, wordEnd > 0 ? wordEnd : limit)}${ELLIPSIS}`
}

export function modelTitle(model: { name: string }, locale: Locale = 'en') {
  const fitting = (
    ['workshop.model.meta.title', 'workshop.model.meta.titleUnbranded'] as const
  )
    .map((key) => t(key, locale, { name: model.name }))
    .find((title) => title.length <= TITLE_MAX)
  if (fitting) return fitting
  const apiKey = 'workshop.model.meta.titleApi'
  const nameBudget = TITLE_MAX - t(apiKey, locale, { name: '' }).length
  return t(apiKey, locale, { name: shortenAtWord(model.name, nameBudget) })
}
