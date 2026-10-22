import { catalogLocalePrefix } from '@/config/catalog-locales'

export const HUB_CREATORS_PATH = '/hub/creators'

export function hubCreatorPath(username: string, locale = 'en') {
  return `${catalogLocalePrefix(locale)}${HUB_CREATORS_PATH}/${encodeURIComponent(username.toLowerCase())}/`
}

export const CREATOR_USERNAME_MAX = 30

const CREATOR_USERNAME = new RegExp(
  `^[a-z0-9][a-z0-9-]{1,${CREATOR_USERNAME_MAX - 2}}[a-z0-9]$`,
  'i'
)

export function isCreatorUsername(raw: string) {
  return CREATOR_USERNAME.test(raw)
}

export const creatorEntityId = (siteUrl: string, username: string) =>
  `${siteUrl}${hubCreatorPath(username)}#creator`
