import { catalogLocalePrefix } from '@/config/catalog-locales'
import { HUB_CREATORS_PATH } from '@/config/hub-models'

export interface HubCreatorSummary {
  readonly username: string
  readonly displayName: string
  readonly avatarUrl?: string
  readonly workflowCount: number
}

const HUB_ASSETS_HOST = 'comfy-hub-assets.comfy.org'

export function hubCreatorPath(username: string, locale = 'en') {
  return `${catalogLocalePrefix(locale)}${HUB_CREATORS_PATH}/${encodeURIComponent(username.toLowerCase())}/`
}

export function hubAvatarUrl(url: string | null | undefined) {
  if (!url || !URL.canParse(url)) return undefined
  const { protocol, hostname, origin, pathname } = new URL(url)
  return protocol === 'https:' && hostname === HUB_ASSETS_HOST
    ? `${origin}/cdn-cgi/image/width=400,format=auto,quality=82${pathname}`
    : undefined
}
