import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const TITLE_MAX = 60

export function modelTitle(model: { name: string }, locale: Locale = 'en') {
  const [full, apiOnly, nameOnly] = (
    [
      'workshop.model.meta.title',
      'workshop.model.meta.titleApi',
      'workshop.model.meta.titleName'
    ] as const
  ).map((key) => t(key, locale, { name: model.name }))
  return [full, apiOnly].find((title) => title.length <= TITLE_MAX) ?? nameOnly
}
