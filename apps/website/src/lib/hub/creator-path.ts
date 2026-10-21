import { catalogLocalePrefix } from '@/config/catalog-locales'

export const HUB_CREATORS_PATH = '/hub/creators'

export function hubCreatorPath(username: string, locale = 'en') {
  return `${catalogLocalePrefix(locale)}${HUB_CREATORS_PATH}/${encodeURIComponent(username.toLowerCase())}/`
}
