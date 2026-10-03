import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const TITLE_MAX = 60
const ELLIPSIS = '…'

function shortenAtWord(text: string, max: number) {
  if (text.length <= max) return text
  const limit = max - ELLIPSIS.length
  const wordEnd = text.lastIndexOf(' ', limit)
  return `${text.slice(0, wordEnd > 0 ? wordEnd : limit)}${ELLIPSIS}`
}

export function modelTitle(model: { name: string }, locale: Locale = 'en') {
  const { t } = translationsFor(locale)
  const fitting = (
    ['workshop.model.meta.title', 'workshop.model.meta.titleUnbranded'] as const
  )
    .map((key) => t(key, { name: model.name }))
    .find((title) => title.length <= TITLE_MAX)
  if (fitting) return fitting
  const apiKey = 'workshop.model.meta.titleApi'
  const nameBudget = TITLE_MAX - t(apiKey, { name: '' }).length
  return t(apiKey, { name: shortenAtWord(model.name, nameBudget) })
}
