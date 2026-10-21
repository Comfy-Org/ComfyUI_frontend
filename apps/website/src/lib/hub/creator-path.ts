import { catalogLocalePrefix } from '@/config/catalog-locales'

export const HUB_CREATORS_PATH = '/hub/creators'

export function hubCreatorPath(username: string, locale = 'en') {
  return `${catalogLocalePrefix(locale)}${HUB_CREATORS_PATH}/${encodeURIComponent(username.toLowerCase())}/`
}

export const CREATOR_USERNAME_MAX = 30

export function isCreatorUsername(raw: string) {
  return (
    raw.length <= CREATOR_USERNAME_MAX &&
    /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/i.test(raw)
  )
}

export const creatorEntityId = (siteUrl: string, username: string) =>
  `${siteUrl}${hubCreatorPath(username)}#creator`
